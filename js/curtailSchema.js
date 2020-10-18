const cfg = require('../config/config');
const mongoose = require("mongoose");
const { Schema } = mongoose;

const curtailSchema = new Schema({
  url: String,
  hash: String,
  curtail: String,
  c_date: { type: Date, default: Date.now },
  u_date: { type: Date, default: Date.now },
  ttl: { type: Number, default: cfg.defaultTTLSec }
});

mongoose.model("curtailSchema", curtailSchema);
