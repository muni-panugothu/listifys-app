'use strict';

const { randomUUID } = require('crypto');

/**
 * Tracer — lightweight distributed tracing for RabbitMQ message flows.
 *
 * Propagates traceId + correlationId through message headers so you can
 * correlate a single user action (e.g. POST /listings) across multiple
 * workers (search.worker → image.worker → notification.worker).
 *
 * For production OpenTelemetry integration, replace the body of each method
 * with calls to @opentelemetry/api context/trace/propagation APIs.
 */
const Tracer = {
  /**
   * Create a root trace context — use at HTTP request entry points.
   */
  createRoot(serviceName) {
    return {
      traceId:       randomUUID(),
      correlationId: randomUUID(),
      spanId:        randomUUID(),
      parentSpanId:  null,
      serviceName:   serviceName ?? process.env.SERVICE_NAME ?? 'listify-api',
      startTime:     Date.now(),
    };
  },

  /**
   * Create a child span — use when consuming a message and spawning sub-work.
   */
  createChild(parent, serviceName) {
    return {
      traceId:       parent.traceId,
      correlationId: parent.correlationId,
      spanId:        randomUUID(),
      parentSpanId:  parent.spanId,
      serviceName:   serviceName ?? process.env.SERVICE_NAME ?? 'listify-api',
      startTime:     Date.now(),
    };
  },

  /**
   * Extract trace context from a message envelope received from a queue.
   */
  extractFromEnvelope(envelope) {
    return {
      traceId:       envelope.traceId       ?? envelope.headers?.['x-trace-id']       ?? randomUUID(),
      correlationId: envelope.correlationId ?? envelope.headers?.['x-correlation-id'] ?? randomUUID(),
      spanId:        randomUUID(),
      parentSpanId:  null,
      serviceName:   envelope.originService ?? 'unknown',
      startTime:     Date.now(),
    };
  },

  /**
   * Inject trace context into ProducerService publish opts.
   * Use when publishing a new event in response to a consumed one.
   */
  inject(context, opts = {}) {
    return {
      ...opts,
      traceId:       context.traceId,
      correlationId: context.correlationId,
      headers: {
        ...(opts.headers ?? {}),
        'x-trace-id':       context.traceId,
        'x-correlation-id': context.correlationId,
        'x-span-id':        context.spanId,
        'x-parent-span-id': context.parentSpanId ?? '',
        'x-service':        context.serviceName,
      },
    };
  },

  /**
   * Return span completion data for structured logging.
   */
  finish(context, operation, extra = {}) {
    return {
      traceId:       context.traceId,
      correlationId: context.correlationId,
      spanId:        context.spanId,
      parentSpanId:  context.parentSpanId,
      service:       context.serviceName,
      operation,
      duration_ms:   Date.now() - context.startTime,
      ...extra,
    };
  },
};

module.exports = Tracer;
