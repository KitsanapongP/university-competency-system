"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Users } from "lucide-react";
import ToastNotifications from "../../../components/ui/ToastNotifications";
import { fetchMyActivitySessions } from "../../../lib/activity-session";
import "../activity-management/ActivityManagement.css";

export default function MyActivitySessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    fetchMyActivitySessions()
      .then(setSessions)
      .catch((error) =>
        setToasts([
          {
            id: "load",
            type: "error",
            message: error?.message || "ไม่สามารถโหลดรอบกิจกรรมได้",
          },
        ]),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="activity-management-page">
      <div className="course-list-header">
        <div className="course-list-header__left">
          <h1 className="course-list-header__title">รอบกิจกรรมของฉัน</h1>
          <p className="course-list-header__subtitle">
            รอบกิจกรรมที่ได้รับมอบหมายให้เช็กชื่อ ให้คะแนน หรือยืนยันผล
          </p>
        </div>
      </div>
      <section className="activity-management__panel">
        <div className="activity-management__panel-header">
          <span>
            <CalendarClock size={16} /> {sessions.length} รอบกิจกรรม
          </span>
        </div>
        <div className="activity-table-wrap">
          <table className="activity-table">
            <thead>
              <tr>
                <th>กิจกรรม</th>
                <th>รอบ</th>
                <th>วันเวลา</th>
                <th>สถานะ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="activity-management__empty">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan="5" className="activity-management__empty">
                    ยังไม่มีรอบกิจกรรมที่ได้รับมอบหมาย
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.sessionId}>
                    <td>
                      <div className="activity-name-cell">
                        <strong>{session.activityNameTh}</strong>
                        <span>{session.activityCode}</span>
                      </div>
                    </td>
                    <td>ครั้งที่ {session.sessionNo}</td>
                    <td>{new Date(session.startAt).toLocaleString("th-TH")}</td>
                    <td>
                      <span
                        className={`activity-status activity-status--${session.status}`}
                      >
                        {session.status}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="course-btn course-btn--primary"
                        href={`/activity-sessions/${session.sessionId}`}
                      >
                        <Users size={16} /> เปิด Workspace
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <ToastNotifications
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((prev) => prev.filter((item) => item.id !== id))
        }
      />
    </div>
  );
}
