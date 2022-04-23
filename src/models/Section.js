const mongoose = require('mongoose')


const sectionSchema = new mongoose.Schema({

  owner: {

    type: mongoose.Schema.Types.ObjectId,

    required: true,

    ref: 'User'

  },

  name: {

    type: String,

    required: true,

    trim: true,

  },

  description: {

    type: String,

    trim: true,

  },

  isPublic: {

    type: Boolean,

    default: false,

  },

  open: {

    type: Boolean,

    default: true,

  },

  canDelete: {

    type: Boolean,

    default: true,

  },

}, { timestamps: true })

// Section Model
const Section = mongoose.model('Section', sectionSchema)

module.exports = Section
