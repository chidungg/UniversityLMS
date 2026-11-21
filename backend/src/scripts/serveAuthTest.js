// Isolated browser-test server. This entry point never connects to MONGO_URI.
import path from 'node:path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../models/User.js';
import { migrateAuth } from './migrateAuth.js';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'browser-tests-only-32-byte-secret-not-for-deployment';
process.env.CLIENT_ORIGIN = 'http://127.0.0.1:4173';
const { app } = await import('../server.js');
const database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { downloadDir: path.resolve('.cache/mongodb-binaries') } });
await mongoose.connect(database.getUri(), { dbName: 'a01_browser_test' });
await User.createCollection(); await User.createIndexes(); await migrateAuth();
const passwordHash = await bcrypt.hash('Browser-test-2026', 12);
for (const role of ['Administrator', 'Instructor', 'Student']) await User.create({ email: `${role.toLowerCase()}@browser.test`, fullName: `Test ${role}`, role, passwordHash });
const server = app.listen(5101, '127.0.0.1', () => console.log('Isolated A01 browser API ready on 5101'));
async function stop() { server.close(); await mongoose.disconnect(); await database.stop(); process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
