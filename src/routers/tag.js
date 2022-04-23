const express = require('express')

const Tag = require('../models/Tag')

const { errorJson } = require('../middleware/errors')

const router = new express.Router()


// Sends post request to create tags
router.post('/api/tag/create', async (req, res) => {

  const newTag = new Tag({

    ...req.body

  })

  try {

    await newTag.save()

    res.status(201).send(newTag)

  } catch (error) {

    res.status(400).send(error)

  }

})


// Sends post request to create tags
router.post('/api/tag/create-many', async (req, res) => {

  let numSaved = 0

  await req.body.forEach(async (tag, index) => {

    const newTag = new Tag({

      name: tag

    })

    try {

      await newTag.save()

      numSaved++

    } catch (error) { }

    if (index === req.body.length - 1) {

      res.status(201).send({ message: `${req.body.length} sent, ${numSaved} saved, ${req.body.length - numSaved} failed` })

    }

  });

})


// Sends get request to get tag BY ID
router.get('/api/tag/retrieve-id/:id', async (req, res) => {

  const _id = req.params.id

  try {

    const tag = await Tag.findOne({ _id })

    if (!tag) return errorJson(res, 404)

    res.send(tag)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends get request to get tag BY name
router.get('/api/tag/retrieve-name', async (req, res) => {

  const name = req.query.name

  try {

    const tag = await Tag.findOne({ name })

    if (!tag) return errorJson(res, 404)

    res.send(tag)

  } catch (error) {

    return errorJson(res, 500)

  }

})


// Sends get request to get filter by name
router.get('/api/tag/retrieve-filter/:name', async (req, res) => {

  const name = req.params.name

  try {

    const reg = new RegExp(`^${name}`, 'i')

    const tag = await Tag.find({ name: reg }).limit(10).sort({ name: 1 })

    if (!tag) return errorJson(res, 404)

    let tagx = []

    if (tag.length < 10) {
      
      const regx = new RegExp(`^(?!${name}).*${name}`, 'i')

      tagx = await Tag.find({ name: regx }).limit(10 - tag.length).sort({ name: 1 })

      if (!tagx) return errorJson(res, 404)

    }

    res.send([...tag, ...tagx])

  } catch (error) {

    return errorJson(res, 500)

  }

})


module.exports = router
