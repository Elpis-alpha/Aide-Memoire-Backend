const mongoose = require('mongoose')
const User = require('./User')


const noteSchema = new mongoose.Schema({

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
    
    default: "",
    
    trim: true,

  },

  text: {

    type: String,

    trim: true,

    required: true,

  },

  sections: {

    type: Array,

    default: []

  },

  tags: {

    type: Array,

    default: []

  },

  canDelete: {

    type: Boolean,

    default: true,

  },

  isPublic: {

    type: Boolean,

    default: false,

  },

  specialName: {

    type: String,

    required: true,

    default: "normal",

  },

}, { timestamps: true })

// Note Model
const Note = mongoose.model('Note', noteSchema)

module.exports = Note
