// The text format is versioned, so notes saved today can still be read after the format changes.
// A document without a version is version 1 (everything written before versions existed).
// To change the format: bump FORMAT_VERSION, and add a migration that turns the old document into the new one.
export const FORMAT_VERSION = 1

type Doc = Record<string, unknown>
// MIGRATIONS[n] upgrades a version-n document to version n + 1.
export type Migrations = Record<number, (doc: Doc) => Doc>
export const MIGRATIONS: Migrations = {}

export class VersionError extends Error {}

// The version a document says it is.
export function readVersion(doc: Doc): number {
  const v = doc.version
  if (v === undefined || v === null) return 1
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new VersionError('"version" must be a whole number, 1 or more')
  return v
}

// Bring a document up to the current version. A newer one is refused rather than guessed at.
export function migrate(doc: Doc, migrations: Migrations = MIGRATIONS, current: number = FORMAT_VERSION): Doc {
  let version = readVersion(doc)
  if (version > current) throw new VersionError('This note was made by a newer version of Euclidnote. Update the app to open it.')
  let out = doc
  while (version < current) {
    const step = migrations[version]
    if (!step) throw new VersionError(`No way to upgrade a version ${version} note`)
    out = step(out)
    version++
  }
  const { version: _version, ...rest } = out
  return rest
}
