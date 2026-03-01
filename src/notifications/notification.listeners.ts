import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationListeners {
  constructor(private notificationGateway: NotificationGateway) {}

  @OnEvent('notification.created')
  handleNotificationCreated(notification: any) {

    this.notificationGateway.sendNotificationToUser(
      notification.recipientId,
      notification
    );
  }
}