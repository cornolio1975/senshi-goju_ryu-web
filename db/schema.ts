import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  created: text('created').notNull(),
  description: text('description').notNull().default(''),
  eventDate: text('event_date').notNull().default(''),
  coverMediaId: text('cover_media_id').notNull().default(''),
  published: integer('published').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  folder: text('folder').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  created: text('created').notNull(),
  description: text('description').notNull().default(''),
  eventDate: text('event_date').notNull().default(''),
  externalUrl: text('external_url').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  published: integer('published').notNull().default(1),
});

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  date: text('date').notNull(),
  venue: text('venue').notNull().default(''),
  published: integer('published').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const dojos = sqliteTable('dojos', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().default(''),
  description: text('description').notNull().default(''),
  whatsapp: text('whatsapp').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active').notNull().default(1),
  published: integer('published').notNull().default(1),
  updated: text('updated').notNull(),
});

export const instructors = sqliteTable('instructors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  rank: text('rank').notNull().default(''),
  bio: text('bio').notNull().default(''),
  contact: text('contact').notNull().default(''),
  whatsapp: text('whatsapp').notNull().default(''),
  photoId: text('photo_id').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active').notNull().default(1),
  updated: text('updated').notNull(),
});

export const dojoInstructors = sqliteTable('dojo_instructors', {
  id: text('id').primaryKey(),
  dojoId: text('dojo_id').notNull(),
  instructorId: text('instructor_id').notNull(),
  role: text('role').notNull().default('Instructor'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const trainingLocations = sqliteTable('training_locations', {
  id: text('id').primaryKey(),
  dojoId: text('dojo_id').notNull(),
  instructorId: text('instructor_id').notNull().default(''),
  venueName: text('venue_name').notNull(),
  address: text('address').notNull().default(''),
  mapsUrl: text('maps_url').notNull().default(''),
  whatsapp: text('whatsapp').notNull().default(''),
  notes: text('notes').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active').notNull().default(1),
  updated: text('updated').notNull(),
});

export const trainingSessions = sqliteTable('training_sessions', {
  id: text('id').primaryKey(),
  dojoId: text('dojo_id').notNull(),
  locationId: text('location_id').notNull(),
  instructorId: text('instructor_id').notNull().default(''),
  dayOfWeek: text('day_of_week').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  ageGroup: text('age_group').notNull().default('All ages'),
  fees: text('fees').notNull().default(''),
  description: text('description').notNull().default(''),
  availability: text('availability').notNull().default('Open for enrolment'),
  status: text('status').notNull().default('published'),
  sortOrder: integer('sort_order').notNull().default(0),
  updated: text('updated').notNull(),
});

export const bulletins = sqliteTable('bulletins', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  branch: text('branch').notNull(),
  launch: integer('launch').notNull(),
  close: integer('close').notNull(),
  enabled: integer('enabled').notNull(),
  updated: text('updated').notNull(),
  image: text('image').notNull().default(''),
  statusMode: text('status_mode').notNull().default('scheduled'),
});

export const bulletinAttachments = sqliteTable('bulletin_attachments', {
  id: text('id').primaryKey(),
  bulletinId: text('bulletin_id').notNull(),
  fileId: text('file_id').notNull(),
  name: text('name').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull().default(0),
  created: text('created').notNull(),
});

export const clubInfo = sqliteTable('club_info', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updated: text('updated').notNull(),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  details: text('details').notNull().default(''),
  ipHash: text('ip_hash').notNull().default(''),
  created: text('created').notNull(),
});
