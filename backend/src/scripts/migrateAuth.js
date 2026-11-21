import 'dotenv/config';
import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import connectDB from '../config/db.js';
import AuthSession from '../models/AuthSession.js';
import PasswordResetRequest from '../models/PasswordResetRequest.js';
import AuthRateLimit from '../models/AuthRateLimit.js';

export async function migrateAuth() {
  // Additive only: never drop existing collections, indexes or academic data.
  for (const model of [AuthSession, PasswordResetRequest, AuthRateLimit]) {
    await model.createCollection();
    await model.createIndexes();
  }
  // Missing mustChangePassword is treated as false; no rewrite of existing users needed.
}
export async function verifyAuthStorage() {
  for (const model of [AuthSession, PasswordResetRequest, AuthRateLimit]) {
    let indexes;
    try { indexes = await model.collection.indexes(); }
    catch { throw new Error('A01 storage is not initialized. Run npm run migrate:auth in backend first.'); }
    for (const [, options] of model.schema.indexes()) {
      if (!indexes.some((index) => index.name === options.name && (!options.unique || index.unique))) {
        throw new Error(`Missing A01 index ${options.name}. Run npm run migrate:auth in backend first.`);
      }
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await connectDB(); await migrateAuth(); console.log('A01 collections and indexes are ready.'); }
  finally { await mongoose.disconnect(); }
}
