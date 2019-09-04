const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const sjcl = require("sjcl");
const { Pool } = require("pg");
const config = require('./config.json');

//const pool = new Pool();
const pool = new Pool({
  user: 'atrinhojjat',
  host: 'localhost',
  database: config.database,
  password: '',
  port: 5432
})


var secret = process.env.SECRET;

var validate = async function(req) {
  let token = req.headers['x-access-token'];
  if(!token) return {auth: false, message: "No Token Found"};
  console.log(token);
  return await jwt.verify(token, secret, function(err, dec) {
    if(err) return { auth: false, message: "Invalid Token" };
    console.log("Authentification Succeded");
    console.log(dec);
    return {auth: true, val: dec};
  });
}

var getUser = async function(usr) {
  return await pool
    .query('SELECT * FROM users WHERE username=$1 or email=$1', [usr])
    .then(res => {
      if(res.rows.lenght === 0) return null;
      return res.rows[0];
    })
    .catch(e => {
      console.error(e.stack);
      return null
    });
}

var checkValidPass = function(pass) {
  let least8 = pass.length >= 8, cap = false, sml = false
    , num = false, neith = false;
  for(let i = 0; i < pass.length; i++) {
    let ch = pass.charAt(i);
    if(ch >= 'a' && ch <= 'z') sml = true;
    else if(ch >= 'A' && ch <= 'Z') cap = true;
    else if(ch >= '0' && ch <= '9') num = true;
    else neith = true;
  }
  return least8 && cap && sml && num && neith;
}

var checkValidUsername = async function(usr) {
  if(usr.length < 8 || usr.length > 32) return false;
  if(!/([A-Z]?[a-z]?[0-9]?)*/g.test(usr)) return false;
  let t = await getUser(usr);
  if(t !== null && t !== undefined) return false;
  return true;
}

var checkValidEmail = async function(email) {
  if(!/(\w|\d)+@(\w|\d)+.(\w)+/g.test(email)) return false;
  let t = await getUser(email);
  if(t !== null && t !== undefined) return false;
  return true;
}

var longin_with_req = async (req, res) {
  let usr = await getUser(req.body.username);
  let psd = req.body.password;

  return loginfunc(usr, psd, res);

}

var loginfunc = async (usr, psd, res) => {
  if(usr === null || usr === undefined) 
    return res.status(406).send({auth: false,
      message: "Username not found"});
  if(usr.password === sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(psd)) ) {
    let tok = jwt.sign({username: usr.username, id: usr.id, seed: process.env.SEED}, secret, { expiresIn: '2h'});
    return res.status(200).send({auth: true, "x-access-token": tok});
  } else {
    return res.status(406).send({auth: false,
      message: "Incorrect Password"});
  }
};

router.put("/singup", async (req, res) => {
  if(await checkValidUsername(req.body.username) && 
    checkValidPass(req.body.password) &&
    await checkValidEmail(req.body.email)) {
    let hash = sjcl.hash.sha256.hash(req.body.password);
    pool.query("INSERT INTO users (username, password, email) VALUES ($1, $3, $2)", 
      [req.body.username, req.body.email, sjcl.codec.hex.fromBits(hash)], (err, resp) => {
      if(err) {
        console.log(err);
        return res.status(500).send({auth: false, message: "Failed to connect With Database"});
      }
      return loginfunc(req.body.email, req.body.password, res);
//      return res.status(200).send({auth: false, message: "You have successfully signed up, please login now"});
    });
  } else {
    return res.status(406).send({auth: false, 
      message:"Repeated Username or Weak Password"});
  }
});

router.post("/login", login_with_req);

router.get("/user", async (req, res) => {
  let tok;
  let usr = await getUser(req.body.username);
  if(usr == null) 
    return res.status(401).send({message: "Username not found"});
  tok = await validate(req);
  if(!tok.auth || tok.val.username !== usr.username) {
    return res.status(200).send({username: usr.username, email: usr.email});
  }
  console.log("itself");
  return res.status(200).send(usr);
});

router.get("/users/:srch", async (req, res) => {
  let str = req.params.srch;
  return await pool
    .query("select username, id from users where username like '%$1%'", str)
    .then((resp) => {
      return res.status(200).send(resp.rows);
    })
    .catch(err => {
      console.error(err.stack);
      return res.status(500).send({message: "Internal Server Error"});
    });
});

router.delete("/delete", async (req, res) => {
  let tok;
  if(!(tok = await validate(req))[auth]) {
    return res.status(403).
      send(tok);
  }
  let tokval = tok.val;
  // TODO
});

router.delete("/delete/confirm", (req, res) => {
  // TODO
});


module.exports = {router: router, validateToken: validate};
