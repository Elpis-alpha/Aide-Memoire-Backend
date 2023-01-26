const express = require('express')

const Section = require('../models/Section')

const auth = require('../middleware/auth')

const { errorJson } = require('../middleware/errors')
const Tag = require('../models/Tag')

const router = new express.Router()


// Sends post request to create sections
router.post('/api/section/create', auth, async (req, res) => {

  const newSection = new Section({

    ...req.body,

    owner: req.user._id

  })

  try {

    await newSection.save()

    res.status(201).send(newSection)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends get request to get all "user owned" sections
router.get('/api/section/get-private', auth, async (req, res) => {

  try {

    const sections = await Section.find({ owner: req.user._id })

    res.send(sections)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends get request to get a section
router.get('/api/section/retrieve/:id', auth, async (req, res) => {

  const _id = req.params.id

  try {

    const section = await Section.findOne({ _id, owner: req.user._id })

    if (!section) return errorJson(res, 404)

    res.send(section)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends get request to get a public section
router.get('/api/section/retrieve-pub/:id', async (req, res) => {

  const _id = req.params.id

  try {

    const section = await Section.findOne({ _id, isPublic: true })

    if (!section) return errorJson(res, 404)

    res.send(section)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends patch request to update sections
router.patch('/api/section/update/:id', auth, async (req, res) => {

  const _id = req.params.id

  const updates = Object.keys(req.body)

  const allowedUpdate = ['name', 'description', 'isPublic']

  const isValidOp = updates.every(section => allowedUpdate.includes(section))

  if (!isValidOp) return res.status(400).send({ error: 'Invalid Updates', allowedUpdates: allowedUpdate })

  try {

    const section = await Section.findOne({ _id, owner: req.user._id })

    if (!section) return errorJson(res, 404)

    updates.forEach(sect => section[sect] = req.body[sect])

    await section.save()

    res.status(201).send(section)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends patch request to toggle open sections
router.post('/api/section/toggle-open/:id', auth, async (req, res) => {

  const _id = req.params.id

  try {

    const section = await Section.findOne({ _id, owner: req.user._id })

    if (!section) return errorJson(res, 404)

    section.open = !section.open

    await section.save()

    res.status(201).send(section.open)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends patch request to toggle public sections
router.post('/api/section/toggle-public/:id', auth, async (req, res) => {

  const _id = req.params.id

  try {

    const section = await Section.findOne({ _id, owner: req.user._id })

    if (!section) return errorJson(res, 404)

    section.isPublic = !section.isPublic

    await section.save()

    res.status(201).send(section.isPublic)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends delete request to delete sections
router.delete('/api/section/delete/:id', auth, async (req, res) => {

  const _id = req.params.id

  try {

    const section = await Section.findOneAndDelete({ _id, owner: req.user._id })

    if (!section) return errorJson(res, 404)

    res.send({ message: 'section deleted' })

  } catch (error) {

    return errorJson(res, 500)

  }

})


module.exports = router
