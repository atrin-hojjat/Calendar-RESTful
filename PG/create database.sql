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