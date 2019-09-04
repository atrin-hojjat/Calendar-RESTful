const express = require("express");
const router = express();
const jwt = require("jsonwebtoken");
//const sjcl = require("sjcl");
const { Pool } = require("pg");
const config = require('./config.json');
const { validateToken } = require('./users.js');

const pool = new Pool();

var secret = process.env.SECRET;

router.get("/calendars", async (req, res) => {
  let tok = await validateToken(req);
  if(!tok.auth) return res.status(403).send({message: "Your Token has expired, Please login again"});
  let cs = await pool
    .query("select calendars.name, calendars.name, calendar.id, roles.name, roles.id, user_roles.username"
      + "from calendars inner join user_roles on calendars.id = user_roles.calendar"
      + "inner join roles on user_roles.role=roles.id where user_roles.username=$1 and roles.see",
      [tok.val.id])
    .then(res => {
      return res;
    })
    .catch(err => {
      console.error(err.stack);
      return null;
    });
  return res.status(200).send({calendars: cs});
});

router.get("/calendars/all", async (req, res) => {
  let cs = await pool
    .query("select name from calendars")
    .then(res => return res)
    .catch(err => {
      console.error(err.stack);
      return null;});
  return res.status(200).send({calendars: cs});
});

//Base functinos
var get_calendar_by_role = async (role) => {
    return await pool
      .query("select cname from roles where id=$1", [role])
      .then(res => return res.rows[0].cname)
      .catch(err => throw err);

};

var get_role_by_user_and_calendar = async (user, calendar) => {
  return await pool
    .query("select role from user_roles where calendar=$1 and username=$2", [calendar, user])
    .then(res => res.rows[0].role)
    .catch(err => throw err);
};

var check_authority_by_username_and_calendar = async (user, calendar, task) => {
  return await check_authority(await get_role_by_user_and_calendar(user, calendar), task);
};

var check_authority = async (role, task) => {
  return await pool
    .query("select " + task + " from roles where id=$1", [role])
    .then(res => return res.rows[0]);
    .catch(err => throw err);
};


//Calendar Basics
router.post("/calendar", /*async*/ (req, res) => {
  let tok = await validateToken(req);
  if(!tok.auth) return res.status(403).send({message: "You need to login in order to create a calendar"});
  try {
    let cal_id = await pool
      .query("insert into calendars (cname) values ($1)returning id", [req.body.calendar_name]);
    let ad_id = await pool
      .query("insert into roles (name, cname, edit_calendar, edit_tast, edit_roles, edit_users, comment, see)"
        + "values ('Admin', $1, true, true, true, true, true, true) returning id", [cal_id]);
    await pool.query("insert int user_roles (username, calendar, role) values ($1, $2, $3)", [tok.val.id, cal_id, ad_id]);
  } catch (err) {
    console.log(err.stack);
    return res.status(500).send({message: 
      "Internal server error while reaching database, please try again, contact admin if problem was not fixed"}); 
  }
});

router.get("/calendar", async (req, res) => {
  let tok = await validateToken(req);
  if(!tok.auth) return res.status(403).send({message: "Your token has expired, please login again"});
  //???
});

router.put("/calendar", async (req, res) => {
  let tok = await validateToken(req);
  if(!tok.auth) return res.status(403).send({message: "Your token has expired, please login again"});
  try {
    let can_edit = check_authority_by_username_and_calendar(tok.val.id, req.headers.calendar, "edit_calendar").edit_calendar;
    if(can_edit === false) 
      return res.status(403).send({message: "You are not authorized to edit roles in this calendar"});
    await pool
      .query("update calendars set cname=$2 where id=$1", [req.headers.calendar, req.headers.new_name]);
    return res.status(200).send({message: "Calendar successfully updated"});
  } catch(err) {
    console.log(err.stack);
    return res.status(500).send({message: 
      "Internal server error while reaching database, please try again, contact admin if problem was not fixed"}); 
  }
  
});

router.delete("/calendar", async (req, res) => {
  let tok = await validateToken(req);
  if(!tok.auth) return res.status(403).send({message: "Your token has expired, please login again"});
  try {
    let can_edit = check_authority_by_username_and_calendar(tok.val.id, req.headers.calendar, "edit_calendar").edit_calendar;
    if(can_edit === false) 
      return res.status(403).send({message: "You are not authorized to edit roles in this calendar"});
    await pool
      .query("delete from calendars where id=$1", [req.headers.calendar]);
    await pool
      .query("delete from roles where cname=$1", [req.headers.calendar]);
    await pool
      .query("delete from user_roles where calendar=$1", [req.headers.calendar]);
    await pool
      .query("delete from tasks where cname=$1", [req.headeres.calendar]);
    return res.status(200).send({message: "Calendar successfully deleted"});
  } catch (err) {
    console.log(err.stack);
    return res.status(500).send({message: 
      "Internal server error while reaching database, please try again, contact admin if problem was not fixed"}); 
  }
});


//Task Basics
router.post("/task", async (req, res) => {
});

router.put("/task", async (req, res) => {
});

router.get("/task", async (req, res) => {
});

router.delete("/task", async (req, res) => {
});

//Roles
router.get("/roles/:calendar/", async (req, res) => {
});

router.post("/role/:calendar", async (req, res) => {

});

router.put("/role/:calendar/", async (req, res) => {

});

router.get("/role/:calendar/", async (req, res) => {

});

router.get("/merge_role/:calendar", async (req, res) => {

});

router.delete("/role/:calendar/", async (req, res) => {
  let tok = await validateToken(req);
  if(!tok.auth) return res.status(403).send({message: "Your token has expired, please login again"});
  try {
    let can_edit = check_authority_by_username_and_calendar(tok.val.id, req.headers.calendar, "edit_roles").edit_roles;
    if(can_edit === false) 
      return res.status(403).send({message: "You are not authorized to edit roles in this calendar"});
    await pool
      .query("delete from roles where id=$1", [req.headers.role]);
    await pool
      .query("delete from user_roles where role=$1", [req.headers.role]);
    return res.status(200).send({message: "Role successfully deleted"});
  } catch(err) {
    console.log(err.stack);
    return res.status(500).send({message: 
      "Internal server error while reaching database, please try again, contact admin if problem was not fixed"}); 
  }
});

//Users
router.get("/users/:calendar/", async (req, res) => {

});

router.post("/user/:calendar/:user", async (req, res) => {
});

router.put("/user/:calendar/:user", async (req, res) => {
});

router.delete("/user/:calendar/:user", async (req, res) => {
});



module.exports = {router: router};
