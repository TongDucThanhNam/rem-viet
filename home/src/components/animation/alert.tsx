"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type NotificationType = "success" | "error" | "warning" | "info";

type Notification = {
  id: number;
  message: string;
  type: NotificationType;
};

const notificationVariants = {
  initial: { opacity: 0, y: 50, scale: 0.3 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.5, transition: { duration: 0.2 } },
};

const NotificationItem: React.FC<{ notification: Notification }> = ({
  notification,
}) => {
  const bgColor = {
    success: "bg-green-500",
    error: "bg-red-500",
    warning: "bg-yellow-500",
    info: "bg-blue-500",
  };

  return (
    <motion.div
      layout
      variants={notificationVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`${bgColor[notification.type]} text-white p-4 rounded-lg shadow-lg`}
    >
      {notification.message}
    </motion.div>
  );
};

export const NotificationContainer: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNotifications((currentNotifications) =>
        currentNotifications.filter(
          (notification) => Date.now() - notification.id < 5000,
        ),
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const showNotification = useCallback(
    (message: string, type: NotificationType = "info") => {
      const newNotification = {
        id: Date.now(),
        message,
        type,
      };
      setNotifications((prev) => [...prev, newNotification]);
    },
    [],
  );

  return (
    <>
      <div className="fixed top-4 right-4 space-y-2 z-50">
        <AnimatePresence>
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
            />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
};

// Custom hook to use notifications
export const useNotification = () => {
  const [, forceUpdate] = useState({});

  const showNotification = useCallback(
    (message: string, type: NotificationType = "info") => {
      // This is a workaround to trigger a re-render in the NotificationContainer
      forceUpdate({});

      const event = new CustomEvent("show-notification", {
        detail: { message, type },
      });
      window.dispatchEvent(event);
    },
    [],
  );

  return showNotification;
};

// Wrap your app with this component
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <>
      {children}
      <NotificationContainer />
    </>
  );
};

export default NotificationProvider;
