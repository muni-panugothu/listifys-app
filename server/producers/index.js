'use strict';

module.exports = {
  AuthProducer:         require('./auth.producer'),
  ListingProducer:      require('./listing.producer'),
  ChatProducer:         require('./chat.producer'),
  BookingProducer:      require('./booking.producer'),
  PaymentProducer:      require('./payment.producer'),
  NotificationProducer: require('./notification.producer'),
  AnalyticsProducer:    require('./analytics.producer'),
};
