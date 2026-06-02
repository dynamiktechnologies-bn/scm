import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Bell, X, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { cn } from "../ui";
import toast from "react-hot-toast";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  document_type: string | null;
  document_id: number | null;
  document_number: string | null;
  is_read: boolean;
  created_at: string;
}

export function NotificationCenter() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // Fetch notifications every 10 seconds
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications").then((r) => r.data),
    refetchInterval: 10000,
  });

  const { data: unreadCount } = useQuery<{ unread_count: number }>({
    queryKey: ["notifications-unread-count"],
    queryFn: () => api.get("/notifications/unread-count").then((r) => r.data),
    refetchInterval: 10000,
  });

  const markAsRead = useMutation({
    mutationFn: (notificationId: number) =>
      api.put(`/notifications/${notificationId}/read`, { is_read: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: () => api.post("/notifications/mark-all-read"),
    onSuccess: () => {
      toast.success("All notifications marked as read");
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: (notificationId: number) =>
      api.delete(`/notifications/${notificationId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const unread = unreadCount?.unread_count ?? 0;
  const recent = notifications.slice(0, 5);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "APPROVAL_PENDING":
        return <Clock size={14} className="text-amber-600" />;
      case "APPROVED":
        return <CheckCircle2 size={14} className="text-emerald-600" />;
      case "REJECTED":
        return <AlertCircle size={14} className="text-red-600" />;
      default:
        return <Bell size={14} className="text-slate-600" />;
    }
  };

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-slate-200 z-50 max-h-96 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  className="text-xs font-medium text-violet-600 hover:text-violet-700"
                  onClick={() => markAllAsRead.mutate()}
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-xs text-slate-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={24} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs text-slate-500">No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {recent.map((notif) => (
                  <div
                    key={notif.id}
                    className={cn(
                      "p-3 rounded-lg border text-xs space-y-1 cursor-pointer transition-colors hover:shadow-sm",
                      notif.is_read ? "bg-slate-50 border-slate-100" : "bg-white border-slate-200"
                    )}
                    onClick={() => !notif.is_read && markAsRead.mutate(notif.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900">{notif.title}</p>
                          <p className="text-slate-600 mt-0.5">{notif.message}</p>
                          <p className="text-slate-400 mt-1">
                            {new Date(notif.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {!notif.is_read && (
                        <div className="w-2 h-2 bg-violet-600 rounded-full flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification.mutate(notif.id);
                      }}
                      className="text-slate-400 hover:text-slate-600 text-xs mt-1"
                    >
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-200 p-3 text-center">
              <a
                href="/notifications"
                className="text-xs font-medium text-violet-600 hover:text-violet-700"
              >
                View all notifications →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Close overlay when clicking outside */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
