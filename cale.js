const express = require("express");
const router = express();
const jwt = require("jsonwebtoken");
//const sjcl = require("sjcl");
const { Pool } = require("pg");
const config = require('./config.json');
const { validateToken } = require('./users.js');

const pool = new Pool();

var secret = process.env.SECRET;

router.use(async (req, res, next) => {
  let tok = await validateToken(req);
  if(!tok.auth) return res.status(403).send({message: "Your Token has expired, Please login again"});
  req.tok = tok;
  next()
});

router.get("/calendars", async (req, res) => {
  let tok = req.tok;
  let cs = await pool
    .query("select calendars.cname, calendars.id as calendar_id, roles.name as role, roles.id as role_id, user_roles.username "
      + "from calendars inner join user_roles on calendars.id = user_roles.calendar "
      + "inner join roles on user_roles.role=roles.id where user_roles.username=$1 and roles.see",
      [tok.val.id])
    .then(res => {
      return res.rows;
    })
    .catch(err => {
      console.error(err.stack);
      return null;
    });
  return res.status(200).send({calendars: cs});
});

router.get("/calendars/all", async (req, res) => {
  let cs = await pool
    .query("select cname from calendars")
    .then(res => res)
    .catch(err => {
      console.error(err.stack);
      return null;});
  return res.status(200).send({calendars: cs});
});

//Base functinos
var get_calendar_by_role = async (role) => {
  return await pool
    .query("select cname from roles where id=$1", [role])
    .then(res => {
      if(res.rows.length) 
        return res.rows[0].cname 
      else return null})
    .catch(err => null);

};

var get_role_by_user_and_calendar = async (user, calendar) => {
  return await pool
    .query("select role from user_roles where calendar=$1 and username=$2", [calendar, user])
    .then(res => {
      if(res.rows.length) 
        return res.rows[0].role 
      else return null})
    .catch(err => null);
};

var check_authority_by_username_and_calendar = async (user, calendar, task) => {
  return await check_authority(await get_role_by_user_and_calendar(user, calendar), task);
};

var check_authority = async (role, task) => {
  if(role == null) return null;;
  return await pool
    .query("select " + task + " from roles where id=$1", [role])
    .then(res => res.rows[0])
    .catch(err => null);
};


//Calendar Basics
router.post("/calendar", async (req, res) => {
  let tok = req.tok;
  try {
    if(req.body.calendar_name === null) 
      return res.status(300).send({message: "Please fill out all the boxes"});
    let cal_id = (await pool
      .query("insert into calendars (cname) values ($1)returning id", [req.body.calendar_name])).rows[0].id;
    let ad_id = (await pool
      .query("insert into roles (name, cname, edit_calendar, edit_task, edit_roles, edit_users, comment, see) "
        + "values ('Admin', $1, true, true, true, true, true, true) returning id", [cal_id])).rows[0].id;
    pool.query("insert into user_roles (username, calendar, role) values ($1, $2, $3)", [tok.val.id, cal_id, ad_id]);
    return res.status(200).send({message: "Calendar successfully created"});
  } catch (err) {
    console.log(err.stack);
    return res.status(500).send({message: 
      "Internal server error while reaching database, please try again, contact admin if problem was not fixed"}); 
  }
});

router.get("/calendar", async (req, res) => {
  let tok = req.tok;
  //???
});

router.put("/calendar", async (req, res) => {
  let tok = req.tok;
  try {
    let auth = check_authority_by_username_and_calendar(tok.val.id, req.headers.calendar, "edit_calendar");
    if(auth === null)
      return res.status(404).send({message: "data not found"})
    let can_edit = auth.edit_calendar;
    if(can_edit === false) 
      return res.status(403).send({message: "You are not authorized to edit roles in this calendar"});
    if(req.body.calendar_name === null) 
      return res.status(300).send({message: "Please fill out all the boxes"});
    pool
      .query("update calendars set cname=$2 where id=$1", [req.headers.calendar, req.body.new_name]);
    return res.status(200).send({message: "Calendar successfully updated"});
  } catch(err) {
    console.log(err.stack);
    return res.status(500).send({message: 
      "Internal server error while reaching database, please try again, contact admin if problem was not fixed"}); 
  }
  
});

router.delete("/calendar", async (req, res) => {
  let tok = req.tok;
  try {
    let auth = check_authority_by_username_and_calendar(tok.val.id, req.headers.calendar, "edit_calendar");
    if(auth === null)
      return res.status(404).send({message: "data not found"})
    let can_edit = auth.edit_calendar;
    if(can_edit === false) 
      return res.status(403).send({message: "You are not authorized to edit roles in this calendar"});
    pool
      .query("delete from calendars where id=$1", [req.headers.calendar]);
    pool
      .query("delete from roles where cname=$1", [req.headers.calendar]);
    pool
      .query("delete from user_roles where calendar=$1", [req.headers.calendar]);
    pool
      .query("delete from tasks where cname=$1", [req.headers.calendar]);
    return res.status(200).send({message: "Calendar successfully deleted"});
  } catch (err) {
    console.log(err.stack);
    return res.status(500).send({message: 
      "Internal server error while reaching database, please try again, contact admin if problem was not fixed"}); 
  }
});


var check_calendar_access = (req, res, nx) => {
  let tok = req.tok;
  try {
    let auth = check_authority_by_username_and_calendar(tok.val.id, req.headers.calendar, "see");
    if(auth === null)
      return res.status(404).send({message: "data not found"})
    let can_see = auth.see;
    if(can_see === false) 
      return res.status(403).send({message: "You are not allowed to see this calendar"});
    nx()
  } catch (err) {
    return res.status(500).send({message: "Internal Server Error"});
  }
};

//Task Basics
router.use("/task/edit", [check_calendar_access, (req, res, nx) => {
  let tok = req.tok;
  try {
    let auth = check_authority_by_username_and_calendar(tok.val.id, req.headers.calendar, "edit_task");
    if(auth === null)
      return res.status(404).send({message: "data not found"})
    let can_edit = auth.edit_tast;
    if(can_edit === false) 
      return res.status(403).send({message: "You are not allowed to see this calendar"});
    nx()
  } catch (err) {
    return res.status(500).send({message: "Internal Server Error"});
  }
}]);
router.use("/tasks", check_calendar_access);
router.use("/get_task/:task", check_calendar_access);

router.post("/task", async (req, res) => {
  let vars = [req.body.task_name, req.body.description, res.headers.calendar, req.body.sdate, 
    req.body.edate, req.body.repeate === null ? "0000/00/00 00:00:00.000" : req.body.repeate];
  for(let x of vars)
    if(x === null)
      return res.status(300).send({message: "Please fill all the forms"});
  return await pool
    .query("insert into tasks values ($1, $2, $3, $4, $5, $6)",vars) 
    .then(resp => {
      return res.status(200).send({message: "Task Successfully added"});
    })
    .catch(err => {
      console.error(err.stack);
      return res.status(500).send({message: "Internal Server Error, please try again later"});
    });
});

router.put("/task/edit", async (req, res) => {
});

router.get("/get_task/:task", async (req, res) => {
  return await pool
    .query("select * from tasks where id=$1", req.params.task)
    .then(result => res.status(200).send({values: result.rows[0]}))
    .catch(err => {
      console.log(err.stack)
      return res.status(500).send({message:"Internal Server error"});
    });
});

router.get("/tasks/:calendar/:sdate/:edate", async (req, res) => {
});

router.delete("/task/edit", async (req, res) => {
  return await pool
    .query("delete from tasks where id=$1", req.headers.task_id)
    .then( result => res.status(200).send({message: "Task deleted"}))
    .catch( err => {
      console.log(err.stack)
      return res.status(500).send({message: "Internal server error"})
    })
});

//Roles

var check_role_edit_access = async (req, res, next) => {
  let tok = req.tok;
  try {
    let auth = check_authority_by_username_and_calendar(tok.val.id, req.headers.calendar, "edit_roles");
    if(auth === null)
      return res.status(404).send({message: "data not found"})
    let can_edit = auth.edit_roles;
    if(can_edit === false) 
      return res.status(403).send({message: "You are not authorized to edit roles in this calendar"});
    next();
  } catch(err) {
    console.error(err.stack);
    return res.status(500).send({message: "Internal server error"});
  }
};

router.use("/roles/:calendar", check_role_edit_access);
router.use("/role/:calendar", check_role_edit_access);
router.use("/merge_roles/", check_role_edit_access);

router.get("/roles/:calendar/", async (req, res) => {
  return await pool
    .query("select * from roles where cname=$1", [req.params.calendar])
    .then(resp => {
      return res.status(200).send({values: resp.rows});
    })
    .catch(err => {
      console.error(err.stack);
      return res.status(500).send({message: "Internal sever error"});
    });
});

router.post("/role/:calendar", async (req, res) => {
  let tok = req.tok;
  try {
    let vars = [req.body.role_name, req.params.calendar, req.body.edit_task, req.body.edit_roles, 
      req.body.edit_users, req.body.comment, req.body.see, req.body.edit_calendar]
    for(let x of vars)
      if(x === null)
        return res.status(300).send({message: "All fields must be filled"});
    let role = (await pool
      .query("insert into roles(name, cname, edit_task, edit_roles, edit_users, comment, see, edit_calendar) "
        + "values ($1, $2, $3, $4, $5, $6, $7, $8) returning name, id", vars)) 
      .rows[0];
    return res.status(200).send({message: "Role successfully updated", role: role});
  } catch (err) {
    console.error(err.stack);
    return res.status(500).send({message: "Internal server error, try again later"});
  }
});

router.put("/role/:calendar/", async (req, res) => {
  let tok = req.tok;
  try {
    let vars = [req.body.role_name, req.body.edit_task, req.body.edit_roles,
      req.body.edit_users, req.body.comment, req.body.see, req.body.edit_calendar, req.body.role_id];
    if(req.body.role_name.length > 32) return res.status(400).send({message: "Role name can be at most 32 characters"});
    for(let x of vars)
      if(x === null)
        return res.status(300).send({message: "All fields must be filled"});
    await pool
      .query("update roles set name=$1, edit_task=$2, edit_roles=$3, edit_users=$4, comment=$5, see=$6, edit_calendar=$7 " 
        + "where id=$8", vars); 
    return res.status(200).send({message: "Role successfully updated"});
  } catch (err) {
    console.error(err.stack);
    return res.status(500).send({message: "Internal server error, try again later"});
  }

});

router.get("/my_role/:calendar", async (req, res) => {
  let tok = req.tok;
  try {
    let role = await get_role_by_user_and_calendar(tok.val.id, req.params.calendar);
    if(role === null) return res.status(404).send({message: "data not found"});
    console.log(role);
    let rl = await pool
      .query("select * from roles where id=$1", [role])
      .then(res => {return res.rows[0];})
      .catch(err => {throw err});
    return res.status(200).send({val: rl});
  } catch(err) {
    console.error(err.stack);
    return res.status(500).send({message: "Internal server error"});
  }
});

router.get("/role/:calendar/", async (req, res) => {
  let tok = req.tok;
  try {
    let rl = await pool
      .query("select * from roles where id=$1", [req.headers.role])
      .then(res => {if(res.rows.length > 0) return res.rows[0]; else return null;})
      .catch(err => {throw err});
    return res.status(200).send({val: rl});
  } catch(err) {
    console.error(err.stack);
    return res.status(500).send({message: "Internal server error"});
  }
});

router.get("/merge_role/:calendar", async (req, res) => {
  //TODO
});

router.delete("/role/:calendar/", async (req, res) => {
  let tok = req.tok;
  try {
    if(req.headers.role === null) 
      return status.send(300).send({message: "Please fill out the forms"});
    pool
      .query("delete from roles where id=$1", [req.headers.role]);
    pool
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
