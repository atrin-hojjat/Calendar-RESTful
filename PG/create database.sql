-- Database: Calendar

-- DROP DATABASE "Calendar";

CREATE DATABASE "Calendar"
    WITH 
    OWNER = atrinhojjat
    ENCODING = 'UTF8'
    LC_COLLATE = 'C'
    LC_CTYPE = 'C'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

user Calendar;

create table users ( 
	username varchar(32) NOT NULL,
	email varchar(50) NOT NULL,
	password varchar NOT NULL,
	id SERIAL PRIMARY KEY);

create table calendars (
	cname varchar(32) not null,
	admin_role serial not null,
	everyone_role serial not null,
	id serial primary key);

create table tasks (
	tname varchar(32) not null,
	description varchar(256),
	cname serial not null,
	sdate date not null,
	edate date not null,
	repeated date,
	id SERIAL PRIMARY KEY);

create table roles (
	id serial primary key,
	cname serial not null,
	edit_task boolean not null,
	edit_roles boolean not null,
	edit_users boolean not null,
	comment boolean not null,
	see boolean not null);

create table user_roles (
	username serial not null,
	calendar serial not null,
	role serial not null);
