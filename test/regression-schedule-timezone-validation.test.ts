import assert from "node:assert/strict";
import test from "node:test";
import { CronScheduleCalculator } from "../src/monitoring/schedule-calculator.js";
test("manual and automatic schedules validate timezone identifiers",()=>{const calculator=new CronScheduleCalculator();for(const kind of ["manual","daily"] as const){assert.throws(()=>calculator.validate({kind,timezone:"Mars/Olympus"}));calculator.validate({kind,timezone:"America/New_York"});calculator.validate({kind,timezone:"UTC"})}});
