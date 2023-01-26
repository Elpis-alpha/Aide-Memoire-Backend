const express = require('express')

const { ObjectId } = require('mongodb')

const auth = require('../middleware/auth')

const Note = require('../models/Note')

const { errorJson } = require('../middleware/errors')

const Tag = require('../models/Tag')

const Section = require('../models/Section')

const router = new express.Router()


// Sends post request to create note
router.post('/api/note/create', auth, async (req, res) => {

  const newNote = new Note({

    ...req.body,

    owner: req.user._id

  })

  try {

    await newNote.save()

    res.status(201).send(newNote)

  } catch (error) {

    console.log(error)

    return errorJson(res, 400)

  }

})


// Sends get request to get all note
router.get('/api/note/get-private', auth, async (req, res) => {

  try {

    const userNotes = await Note.find({ owner: req.user }, { name: 1, sections: 1, tags: 1 })

    res.send(userNotes)

  } catch (error) {

    return errorJson(res, 404)

  }

})


// Sends get request to get a specific note
router.get('/api/note/retrieve/:id', auth, async (req, res) => {

  const _id = req.params.id

  try {

    const note = await Note.findOne({ _id, owner: req.user._id })

    if (!note) return errorJson(res, 404)

    res.send(note)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends get request to get a specific note by its special name
router.get('/api/note/special-re/:name', auth, async (req, res) => {

  const specialName = req.params.name

  try {

    const note = await Note.findOne({ specialName, owner: req.user._id })

    if (!note) return errorJson(res, 404)

    res.send(note)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends get request to get a specific public note
router.get('/api/note/public/retrieve/:id', async (req, res) => {

  const _id = req.params.id

  try {

    const note = await Note.findOne({ _id, isPublic: true })

    if (!note) return errorJson(res, 404)

    res.send(note)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends get request to get all note based on name filter
router.get('/api/note/get-notes/list/by-qa', auth, async (req, res) => {

  const name = req.query.q.toLowerCase().trim()

  try {

    const reg = new RegExp(`${name}`, 'i')

    const notes = await Note.find({ name: reg, owner: req.user._id }, { name: 1, updatedAt: 1, owner: 1, description: 1 })

    if (!notes) return errorJson(res, 404)

    res.send(notes)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends get request to get all note based on name filter (no auth)
router.get('/api/note/get-notes/list/by-q', async (req, res) => {

  const name = req.query.q.toLowerCase().trim()

  try {

    const reg = new RegExp(`${name}`, 'i')

    const notes = await Note.find({ name: reg, isPublic: true }, { name: 1, updatedAt: 1, owner: 1 })

    if (!notes) return errorJson(res, 404)

    res.send(notes)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends get request to get all note based on name filter (no auth)
router.get('/api/note/get-notes/list/by-f-name-NA', async (req, res) => {

  const tagID = req.params.tagID

  try {

    const userNotes = await Note.find({

      "tags": {

        $elemMatch: { _id: ObjectId(tagID) }

      }, isPublic: true

    }, { name: 1, createdAt: 1, updatedAt: 1 })

    res.send(userNotes)

  } catch (error) {

    return errorJson(res, 404)

  }

})


// Sends get request to get all note based on tag ID
router.get('/api/note/get-notes/list/by-tag/:tagID', auth, async (req, res) => {

  const tagID = req.params.tagID

  try {

    const userNotes = await Note.find({

      owner: req.user._id, "tags": {

        $elemMatch: { _id: ObjectId(tagID) }

      }

    }, { name: 1, createdAt: 1, updatedAt: 1 })

    res.send(userNotes)

  } catch (error) {

    return errorJson(res, 404)

  }

})


// Sends get request to get all note based on tag ID (no auth)
router.get('/api/note/get-notes/list/by-tag-NA/:tagID', async (req, res) => {

  const tagID = req.params.tagID

  try {

    const userNotes = await Note.find({

      "tags": {

        $elemMatch: { _id: ObjectId(tagID) }

      }, isPublic: true

    }, { name: 1, createdAt: 1, updatedAt: 1 })

    res.send(userNotes)

  } catch (error) {

    return errorJson(res, 404)

  }

})


// Sends patch request to update note
router.patch('/api/note/update/:id', auth, async (req, res) => {

  const _id = req.params.id

  const updates = Object.keys(req.body)

  const allowedUpdate = ['name', 'text', 'description']

  const isValidOp = updates.every(note => allowedUpdate.includes(note))

  if (!isValidOp) return res.status(400).send({ error: 'Invalid Updates', allowedUpdates: allowedUpdate })

  try {

    const note = await Note.findOne({ _id, owner: req.user._id })

    updates.forEach(up => note[up] = req.body[up])

    await note.save()

    if (!note) return res.status(404).send({ error: 'Not Found' })

    res.status(201).send(note)

  } catch (error) {

    return errorJson(res, 400)

  }

})


// Sends patch request to add tag
router.post('/api/note/add-tag/:id', auth, async (req, res) => {

  const noteID = req.params.id

  try {

    const note = await Note.findOne({ _id: noteID, owner: req.user._id })

    const tag = await Tag.findOne({ _id: req.body.id })

    if (!note || !tag) return errorJson(res, 404)

    note.tags.push({ _id: tag._id, name: tag.name })

    note.tags = note.tags.filter((v, i, s) => s.findIndex(h => h._id.toString() === v._id.toString()) === i)

    await note.save()

    res.send(note.tags)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends patch request to remove tag
router.post('/api/note/remove-tag/:id', auth, async (req, res) => {

  const noteID = req.params.id

  try {

    const note = await Note.findOne({ _id: noteID, owner: req.user._id })

    if (!note) return errorJson(res, 404)

    note.tags = note.tags.filter(tag => tag._id.toString() !== req.body.id)

    note.tags = note.tags.filter((v, i, s) => s.findIndex(h => h._id.toString() === v._id.toString()) === i)

    await note.save()

    res.send(note.tags)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends patch request to add section
router.post('/api/note/add-section/:id', auth, async (req, res) => {

  const noteID = req.params.id

  try {

    const note = await Note.findOne({ _id: noteID, owner: req.user._id })

    const section = await Section.findOne({ _id: req.body.id, owner: req.user._id })

    if (!note || !section) return errorJson(res, 404)

    note.sections = note.sections.concat({ _id: section._id, name: section.name })

    note.sections = note.sections.filter((v, i, s) => s.findIndex(h => h._id.toString() === v._id.toString()) === i)

    await note.save()

    res.send(note.sections)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends patch request to remove section
router.post('/api/note/remove-section/:id', auth, async (req, res) => {

  const noteID = req.params.id

  try {

    const note = await Note.findOne({ _id: noteID, owner: req.user._id })

    if (!note) return errorJson(res, 404)

    note.sections = note.sections.filter(tag => tag._id.toString() !== req.body.id)

    note.sections = note.sections.filter((v, i, s) => s.findIndex(h => h._id.toString() === v._id.toString()) === i)

    await note.save()

    res.send(note.sections)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends get request to get sectioned note
router.get('/api/note/get-sec-notes/:id', auth, async (req, res) => {

  const secID = req.params.id

  try {

    const userNotes = await Note.find({

      owner: req.user, "sections": { $elemMatch: { _id: ObjectId(secID) } }

    }, { name: 1, sections: 1, tags: 1, description: 1 })

    res.send(userNotes)

  } catch (error) {

    return errorJson(res, 404)

  }

})


// Sends get request to get public sectioned note
router.get('/api/note/get-pub-sec-notes/:id', async (req, res) => {

  const secID = req.params.id

  try {

    const section = await Section.findOne({ _id: secID, isPublic: true })

    if (!section) return errorJson(res, 404)

    const userNotes = await Note.find({

      "sections": { $elemMatch: { _id: ObjectId(secID) } }

    }, { name: 1, sections: 1, tags: 1, description: 1 })

    res.send(userNotes)

  } catch (error) {

    return errorJson(res, 404)

  }

})


// Sends get request to get public sectioned note
router.get('/api/note/get-pub-sec-note/:secID/:noteID', async (req, res) => {

  const secID = req.params.secID

  const noteID = req.params.noteID

  try {

    const section = await Section.findOne({ _id: secID, isPublic: true })

    if (!section) return errorJson(res, 404)

    const note = await Note.findOne({

      _id: noteID, "sections": { $elemMatch: { _id: ObjectId(secID) } }

    }, { name: 1, sections: 1, tags: 1, description: 1, text: 1 })

    if (!note) return errorJson(res, 404)

    res.send({ section, note })

  } catch (error) {

    return errorJson(res, 404)

  }

})


// Sends get request to get free sectioned note
router.get('/api/note/get-free-notes/', auth, async (req, res) => {

  try {

    const userNotes = await Note.find({ owner: req.user, sections: { $size: 0 } }, { name: 1, sections: 1, tags: 1 })

    res.send(userNotes)

  } catch (error) {

    return errorJson(res, 404)

  }

})


// Sends patch request to toggle public sections
router.post('/api/note/toggle-public/:id', auth, async (req, res) => {

  const _id = req.params.id

  try {

    const note = await Note.findOne({ _id, owner: req.user._id })

    if (!note) return errorJson(res, 404)

    note.isPublic = !note.isPublic

    await note.save()

    res.status(201).send(note.isPublic)

  } catch (error) {

    return errorJson(res, 500)

  }

})

// Sends delete request to delete note
router.delete('/api/note/delete/:id', auth, async (req, res) => {

  const _id = req.params.id

  try {

    const note = await Note.findOneAndDelete({ _id, owner: req.user._id, canDelete: true })

    if (!note) return errorJson(res, 404)

    res.send({ message: 'note deleted' })

  } catch (error) {

    return errorJson(res, 500)

  }

})


module.exports = router
