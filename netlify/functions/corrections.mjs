// The live site's chord corrections endpoint: /.netlify/functions/corrections
// What it does is in ../shared/review.js; this file only connects it to Netlify Blobs.
// Needs the REVIEW_SECRET environment variable (Site settings → Environment variables), the
// same value as in your local .env.local, so share links made in dev work on the site.

import { getStore } from '@netlify/blobs'
import { handleCorrections } from '../shared/review.js'

export default async (request) => {
    const blobs = getStore({ name: 'corrections', consistency: 'strong' })
    const store = {
        get: (key) => blobs.get(key, { type: 'json' }),
        set: (key, value) => blobs.setJSON(key, value),
        list: async (prefix) => (await blobs.list({ prefix })).blobs.map(b => b.key),
    }
    return handleCorrections(request, { store, secret: process.env.REVIEW_SECRET })
}
