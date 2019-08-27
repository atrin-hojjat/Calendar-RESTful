const express = require("express");
const router = express();
const jwt = require("jsonwebtoken");
//const sjcl = require("sjcl");
const { Pool } = require("pg");
const config = require('./config.json');

//const pool = new Pool();

var secret = process.env.SECRET;

module.exports = {router: router};
