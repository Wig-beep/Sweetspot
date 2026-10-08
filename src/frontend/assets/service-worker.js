/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

/*
 * Service worker of SweetSpot: keeps the files of the app on the device so
 * that it works without a connection. The build inserts the version and the
 * list of files to keep (see util/ServiceWorkerPlugin.ts).
 *
 * - Pages are fetched from the network when online, so that updates arrive,
 *   and from the device when offline. Only the page stored with this version
 *   is used offline, so that it always matches the stored files.
 * - Other files have content hashes in their names, so a stored copy is
 *   always right and is used first.
 * - A new version is stored next to the old one and takes over once all
 *   SweetSpot pages are closed, or at once when the page asks for it (the
 *   "Use the new version" button); the old one is then removed.
 */

const VERSION = self.__SWEETSPOT_VERSION
const PRECACHE = self.__SWEETSPOT_PRECACHE
const CACHE = "sweetspot-" + VERSION
const START_PAGE = "SweetSpot.html"

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)))
})

// the page asks the waiting new version to take over
self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") {
        self.skipWaiting()
    }
})

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys
                .filter((key) => key.startsWith("sweetspot-") && key !== CACHE)
                .map((key) => caches.delete(key))))
            .then(() => self.clients.claim()))
})

self.addEventListener("fetch", (event) => {
    const request = event.request
    if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
        return
    }
    if (request.mode === "navigate") {
        // the page from the network is not stored: it may belong to a newer
        // version whose files are not stored yet
        event.respondWith(
            fetch(request).catch(async () => {
                const cache = await caches.open(CACHE)
                return (await cache.match(request, { ignoreSearch: true }))
                    ?? (await cache.match(START_PAGE))
                    ?? Response.error()
            }))
        return
    }
    // files of this version first; the stylesheet's address has its
    // version in the query (?v=...), so the query is not compared
    event.respondWith(
        caches.open(CACHE)
            .then((cache) => cache.match(request, { ignoreSearch: true }))
            .then((cached) => cached ?? fetch(request)))
})
