/**
 * AWS OpenSearch / Elasticsearch Configuration — Production-Grade
 *
 * UNIFIED INDEX (listify_products) with:
 *   - search_as_you_type for instant autocomplete (Flipkart/Amazon-style)
 *   - edge_ngram analyzer for prefix matching
 *   - Synonym-aware search analyzer
 *   - Dynamic field mapping — auto-indexes ALL MongoDB fields (no manual per-entity code)
 *
 * Auth modes (auto-detected):
 *   1. AWS OpenSearch IAM Sig V4   → AWS_OPENSEARCH_IAM_AUTH=true
 *   2. Basic auth                  → ELASTIC_USERNAME + ELASTIC_PASSWORD
 *   3. Elastic Cloud API key       → ELASTICSEARCH_API_KEY
 */

const { Client } = require('@elastic/elasticsearch');
const { Transport } = require('@elastic/transport');
const { logger } = require('../utils/logger');

let client = null;
let isConnected = false;

// ── Unified index — one index for ALL categories (like Flipkart) ──
const UNIFIED_INDEX = 'listify_products';

class OpenSearchCompatibleTransport extends Transport {
  constructor(opts) {
    super({
      ...opts,
      productCheck: null,
      vendoredHeaders: {
        jsonContentType: 'application/json',
        ndjsonContentType: 'application/x-ndjson',
        accept: 'application/json,text/plain',
      },
    });
  }
}

function isAwsOpenSearchEndpoint(endpoint) {
  try {
    const { hostname } = new URL(endpoint);
    return (
      hostname.endsWith('.es.amazonaws.com') ||
      hostname.includes('.aos.') ||
      hostname.endsWith('.aoss.amazonaws.com')
    );
  } catch {
    return false;
  }
}

async function createAwsConnector() {
  const { defaultProvider } = require('@aws-sdk/credential-provider-node');
  const { SignatureV4 } = require('@smithy/signature-v4');
  const { Sha256 } = require('@aws-crypto/sha256-js');

  const region = process.env.AWS_OPENSEARCH_REGION || 'eu-north-1';
  const credentials = defaultProvider();

  const signer = new SignatureV4({
    credentials,
    region,
    service: 'es',
    sha256: Sha256,
  });

  return { signer, region };
}

function buildAwsConnection(signer) {
  const { Connection } = require('@elastic/elasticsearch');

  class AwsSigV4Connection extends Connection {
    async request(params, options) {
      const url = new URL(params.path, this.url.href);
      if (params.querystring) url.search = params.querystring;

      const headers = { ...params.headers, host: url.hostname };
      delete headers['content-length'];

      const signable = {
        method: params.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        headers,
        body: params.body || undefined,
        protocol: url.protocol,
      };

      const signed = await signer.sign(signable);
      params.headers = signed.headers;
      return super.request(params, options);
    }
  }

  return AwsSigV4Connection;
}

// ══════════════════════════════════════════════════════════════════
//  Index Settings — Production Analyzers (Flipkart/Amazon-grade)
// ══════════════════════════════════════════════════════════════════

const INDEX_SETTINGS = {
  // AWS OpenSearch with 3-AZ zone awareness requires (1 + replicas)
  // to be a multiple of 3. Use 1 shard + 2 replicas for AWS, 1+0 locally.
  number_of_shards: 1,
  number_of_replicas: isAwsOpenSearchEndpoint(process.env.ELASTICSEARCH_URL || '') ? 2 : 0,
  'index.max_ngram_diff': 15,
  analysis: {
    analyzer: {
      // Search-time analyzer — synonym-aware, stop-word filtered
      listify_search: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase', 'listify_synonyms', 'listify_stop'],
      },
      // Edge n-gram for autocomplete indexing
      listify_autocomplete: {
        type: 'custom',
        tokenizer: 'listify_edge_ngram',
        filter: ['lowercase'],
      },
      // Search-time analyzer for autocomplete (standard, no ngram)
      listify_autocomplete_search: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase'],
      },
    },
    tokenizer: {
      listify_edge_ngram: {
        type: 'edge_ngram',
        min_gram: 2,
        max_gram: 15,
        token_chars: ['letter', 'digit'],
      },
    },
    filter: {
      listify_synonyms: {
        type: 'synonym',
        lenient: true,
        synonyms: [
          'mobile,phone,smartphone,cellphone',
          'laptop,notebook,computer',
          'car,vehicle,automobile',
          'bike,motorcycle,motorbike',
          'flat,apartment,condo',
          'house,home,villa,bungalow',
          'room,pg,paying guest,hostel',
          'ac,air conditioner',
          'tv,television',
          'fridge,refrigerator',
          'sofa,couch',
          'job,vacancy,career,hiring',
          'pet,animal',
          'dog,puppy',
          'cat,kitten',
          'gym,fitness,exercise',
          'rent,rental,lease',
          'used,second hand,pre owned,preloved',
          'property,properties,house,flat,apartment,room,pg',
          'service,services,plumber,electrician,mechanic,cleaning,repair',
          'electronics,electronic,gadget,appliance',
          'vehicle,vehicles,car,bike,automobile',
          'fashion,clothes,clothing,wear,dress',
          'collectible,collectibles,antique,vintage',
          'takecare,nanny,babysitter,caretaker,childcare',
          'beauty,cosmetic,makeup,skincare',
        ],
      },
      listify_stop: {
        type: 'stop',
        stopwords: '_english_',
      },
    },
  },
};

const INDEX_MAPPINGS = {
  // Dynamic: auto-map any unknown string field from MongoDB
  dynamic: 'true',
  dynamic_templates: [
    {
      strings_as_searchable: {
        match_mapping_type: 'string',
        mapping: {
          type: 'text',
          analyzer: 'listify_search',
          fields: {
            keyword: { type: 'keyword', ignore_above: 256 },
            autocomplete: {
              type: 'text',
              analyzer: 'listify_autocomplete',
              search_analyzer: 'listify_autocomplete_search',
            },
          },
        },
      },
    },
  ],
  properties: {
    // ── Explicit core mappings ──
    _entity: {
      type: 'keyword',
      fields: {
        search: {
          type: 'text',
          analyzer: 'listify_search',
        },
      },
    },
    title: {
      type: 'text',
      analyzer: 'listify_search',
      fields: {
        keyword: { type: 'keyword' },
        autocomplete: {
          type: 'text',
          analyzer: 'listify_autocomplete',
          search_analyzer: 'listify_autocomplete_search',
        },
        suggest: { type: 'search_as_you_type' },
      },
    },
    description: { type: 'text', analyzer: 'listify_search' },
    price:       { type: 'float' },
    category: {
      type: 'text',
      analyzer: 'listify_search',
      fields: {
        keyword: { type: 'keyword' },
        autocomplete: {
          type: 'text',
          analyzer: 'listify_autocomplete',
          search_analyzer: 'listify_autocomplete_search',
        },
      },
    },
    subcategory: {
      type: 'text',
      analyzer: 'listify_search',
      fields: {
        keyword: { type: 'keyword' },
        autocomplete: {
          type: 'text',
          analyzer: 'listify_autocomplete',
          search_analyzer: 'listify_autocomplete_search',
        },
      },
    },
    location: {
      type: 'text',
      analyzer: 'listify_search',
      fields: {
        keyword: { type: 'keyword' },
        autocomplete: {
          type: 'text',
          analyzer: 'listify_autocomplete',
          search_analyzer: 'listify_autocomplete_search',
        },
      },
    },
    brand: {
      type: 'text',
      analyzer: 'listify_search',
      fields: {
        keyword: { type: 'keyword' },
        autocomplete: {
          type: 'text',
          analyzer: 'listify_autocomplete',
          search_analyzer: 'listify_autocomplete_search',
        },
      },
    },
    condition:   { type: 'keyword' },
    status:      { type: 'keyword' },
    slug:        { type: 'keyword' },
    sellerId:    { type: 'keyword' },
    sellerName:  { type: 'text', fields: { keyword: { type: 'keyword' } } },
    images:      { type: 'keyword', index: false },
    phone:       { type: 'keyword', index: false },
    views:       { type: 'integer' },
    currency:    { type: 'keyword' },
    coordinates: { type: 'geo_point' },
    createdAt:   { type: 'date' },
    updatedAt:   { type: 'date' },
  },
};

// ── Init ──────────────────────────────────────────────────────────
const initElasticsearch = async () => {
  const url = process.env.ELASTICSEARCH_URL;

  if (!url) {
    logger.info('ELASTICSEARCH_URL not set — using MongoDB text search as fallback');
    return null;
  }

  try {
    const clientConfig = { node: url };

    if (isAwsOpenSearchEndpoint(url)) {
      clientConfig.Transport = OpenSearchCompatibleTransport;
      logger.info('Elasticsearch: OpenSearch compatibility mode enabled');
    }

    if (process.env.AWS_OPENSEARCH_IAM_AUTH === 'true') {
      const { signer } = await createAwsConnector();
      clientConfig.Connection = buildAwsConnection(signer);
      logger.info('Elasticsearch: using AWS IAM Sig v4 authentication');
    } else if (process.env.ELASTICSEARCH_API_KEY) {
      clientConfig.auth = { apiKey: process.env.ELASTICSEARCH_API_KEY };
      logger.info('Elasticsearch: using Elastic Cloud API key authentication');
    } else if (process.env.ELASTIC_PASSWORD) {
      clientConfig.auth = {
        username: process.env.ELASTIC_USERNAME || 'elastic',
        password: process.env.ELASTIC_PASSWORD,
      };
      logger.info('Elasticsearch: using basic auth');
    }

    if (process.env.NODE_ENV !== 'production') {
      clientConfig.tls = { rejectUnauthorized: false };
    }

    client = new Client(clientConfig);
    await client.ping();
    isConnected = true;
    logger.info('Elasticsearch connected successfully');

    await ensureUnifiedIndex();

    return client;
  } catch (error) {
    logger.error('Elasticsearch connection failed', { error: error.message });
    logger.info('Falling back to MongoDB text search');
    isConnected = false;
    return null;
  }
};

// ── Create unified index ──────────────────────────────────────────
const ensureUnifiedIndex = async () => {
  if (!client) return;

  try {
    const exists = await client.indices.exists({ index: UNIFIED_INDEX });
    if (!exists) {
      await client.indices.create({
        index: UNIFIED_INDEX,
        settings: INDEX_SETTINGS,
        mappings: INDEX_MAPPINGS,
      });
      logger.info(`Created unified Elasticsearch index: ${UNIFIED_INDEX}`);
    } else {
      logger.info(`Elasticsearch unified index exists: ${UNIFIED_INDEX}`);
    }
  } catch (err) {
    logger.error(`Error creating unified index:`, err.meta?.body?.error || err.message);
  }
};

const getClient = () => client;
const getIsConnected = () => isConnected;

module.exports = {
  initElasticsearch,
  getClient,
  getIsConnected,
  ensureUnifiedIndex,
  UNIFIED_INDEX,
};
