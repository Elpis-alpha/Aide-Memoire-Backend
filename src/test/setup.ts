import { afterAll, afterEach, beforeAll } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'

/**
 * A replica set rather than a standalone server: account and section deletion
 * run in transactions (S2-10, S2-15), and Mongo only offers those on a replica
 * set.
 */
let replSet: MongoMemoryReplSet

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(replSet.getUri(), { dbName: 'smoke' })
})

afterEach(async () => {
  // Each test starts from an empty database so ordering never matters.
  const { collections } = mongoose.connection
  await Promise.all(Object.values(collections).map(collection => collection.deleteMany({})))
})

afterAll(async () => {
  await mongoose.disconnect()
  await replSet?.stop()
})
