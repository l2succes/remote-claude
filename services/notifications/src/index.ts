// Notification service exports
export * from './manager';
export * from './channels/email';
export * from './channels/slack';
export * from './channels/pushover';
export * from './channels/webhook';
export * from './templates/engine';

// Default export
export { NotificationManager as default } from './manager';