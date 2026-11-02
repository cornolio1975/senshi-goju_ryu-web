import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const folders = sqliteTable('folders',{id:text('id').primaryKey(),name:text('name').notNull(),created:text('created').notNull()});
export const media = sqliteTable('media',{id:text('id').primaryKey(),folder:text('folder').notNull(),name:text('name').notNull(),type:text('type').notNull(),created:text('created').notNull()});
export const posts = sqliteTable('posts',{id:text('id').primaryKey(),kind:text('kind').notNull(),title:text('title').notNull(),body:text('body').notNull(),date:text('date').notNull()});
