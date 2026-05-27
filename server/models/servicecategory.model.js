const mongoose = require('mongoose');

const serviceCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  icon: {
    type: String,
    default: null
  },
  image: {
    type: String,
    required: true
  },
  subcategories: [{
    name: {
      type: String,
      required: true
    },
    slug: {
      type: String,
      required: true
    },
    description: String,
    icon: String,
    isActive: {
      type: Boolean,
      default: true
    },
    meta: {
      fields: [{
        name: String,
        type: {
          type: String,
          enum: ['text', 'number', 'select', 'checkbox', 'radio', 'date', 'time', 'textarea']
        },
        required: Boolean,
        options: [String],
        placeholder: String
      }],
      filters: [{
        name: String,
        type: String,
        options: [String]
      }]
    }
  }],
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceCategory',
    default: null
  },
  level: {
    type: Number,
    default: 0
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  seo: {
    title: String,
    description: String,
    keywords: [String]
  },
  stats: {
    totalProviders: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Pre-save middleware to generate slug
serviceCategorySchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '-');
  }
  next();
});

module.exports = mongoose.model('ServiceCategory', serviceCategorySchema);