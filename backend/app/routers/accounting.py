from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models.accounting import Account, JournalEntry, JournalLine
from app.schemas.accounting import AccountCreate, AccountOut, JournalEntryOut, JournalLineOut, TrialBalanceLine, ManualJournalCreate
from datetime import datetime, timezone

router = APIRouter(prefix="/accounting", tags=["accounting"])


@router.get("/accounts", response_model=list[AccountOut])
def list_accounts(active_only: bool = True, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(Account)
    if active_only:
        q = q.filter(Account.is_active == True)
    return q.order_by(Account.code).all()


@router.post("/accounts", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def create_account(body: AccountCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if db.query(Account).filter(Account.code == body.code).first():
        raise HTTPException(400, f"Account code {body.code!r} already exists")
    acct = Account(**body.model_dump())
    db.add(acct)
    db.commit()
    db.refresh(acct)
    return acct


@router.put("/accounts/{account_id}", response_model=AccountOut)
def update_account(account_id: int, body: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    acct = db.query(Account).filter(Account.id == account_id).first()
    if not acct:
        raise HTTPException(404, "Account not found")
    # Code is immutable — only allow name, normal_side, is_active changes
    for field in ("name", "normal_side", "is_active"):
        if field in body:
            setattr(acct, field, body[field])
    db.commit()
    db.refresh(acct)
    return acct


@router.get("/journal-entries", response_model=list[JournalEntryOut])
def list_journal_entries(
    source_type: str | None = None,
    reference: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(JournalEntry).options(
        joinedload(JournalEntry.lines).joinedload(JournalLine.account)
    )
    if source_type:
        q = q.filter(JournalEntry.source_type == source_type)
    if reference:
        q = q.filter(JournalEntry.reference.ilike(f"%{reference}%"))
    if from_date:
        q = q.filter(JournalEntry.entry_date >= from_date)
    if to_date:
        q = q.filter(JournalEntry.entry_date <= to_date)
    entries = q.order_by(JournalEntry.id.desc()).limit(200).all()
    return _enrich_entries(entries)


@router.get("/journal-entries/{je_id}", response_model=JournalEntryOut)
def get_journal_entry(je_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    je = db.query(JournalEntry).options(
        joinedload(JournalEntry.lines).joinedload(JournalLine.account)
    ).filter(JournalEntry.id == je_id).first()
    if not je:
        raise HTTPException(404, "Journal entry not found")
    return _enrich_entries([je])[0]


@router.post("/journal-entries", response_model=JournalEntryOut, status_code=status.HTTP_201_CREATED)
def create_manual_journal(body: ManualJournalCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if len(body.lines) < 2:
        raise HTTPException(400, "A journal entry requires at least 2 lines")

    total_dr = sum(l.debit for l in body.lines)
    total_cr = sum(l.credit for l in body.lines)
    if abs(total_dr - total_cr) > Decimal("0.01"):
        raise HTTPException(400, f"Journal entry is not balanced: debits {total_dr} ≠ credits {total_cr}")

    for line in body.lines:
        if not db.query(Account).filter(Account.id == line.account_id, Account.is_active == True).first():
            raise HTTPException(400, f"Account ID {line.account_id} not found or inactive")

    je = JournalEntry(
        entry_date=body.entry_date,
        reference=body.reference,
        memo=body.memo,
        source_type="MANUAL",
        source_id=None,
        is_posted=True,
        posted_at=datetime.now(timezone.utc),
        created_by=current_user.id,
    )
    db.add(je)
    db.flush()

    for line in body.lines:
        db.add(JournalLine(
            entry_id=je.id,
            account_id=line.account_id,
            debit=line.debit,
            credit=line.credit,
            description=line.description,
        ))

    db.commit()
    je = db.query(JournalEntry).options(
        joinedload(JournalEntry.lines).joinedload(JournalLine.account)
    ).filter(JournalEntry.id == je.id).first()
    return _enrich_entries([je])[0]


def _enrich_entries(entries: list[JournalEntry]) -> list[JournalEntryOut]:
    result = []
    for je in entries:
        lines_out = []
        for jl in je.lines:
            lo = JournalLineOut.model_validate(jl)
            if jl.account:
                lo.account_code = jl.account.code
                lo.account_name = jl.account.name
            lines_out.append(lo)
        out = JournalEntryOut.model_validate(je)
        out.lines = lines_out
        result.append(out)
    return result


@router.get("/trial-balance", response_model=list[TrialBalanceLine])
def trial_balance(as_of: str | None = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(
        JournalLine.account_id,
        func.sum(JournalLine.debit).label("total_debit"),
        func.sum(JournalLine.credit).label("total_credit"),
    )
    if as_of:
        q = q.join(JournalEntry).filter(JournalEntry.entry_date <= as_of, JournalEntry.is_posted == True)
    else:
        q = q.join(JournalEntry).filter(JournalEntry.is_posted == True)
    rows = q.group_by(JournalLine.account_id).all()

    result = []
    for row in rows:
        acct = db.query(Account).filter(Account.id == row.account_id).first()
        if not acct:
            continue
        dr = row.total_debit or Decimal("0")
        cr = row.total_credit or Decimal("0")
        balance = dr - cr if acct.normal_side == "D" else cr - dr
        result.append(TrialBalanceLine(
            account_id=acct.id,
            code=acct.code,
            name=acct.name,
            account_type=acct.account_type,
            debit_total=dr,
            credit_total=cr,
            balance=balance,
        ))
    return sorted(result, key=lambda x: x.code)
