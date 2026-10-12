// 部屋の一覧。必要になったときに初めて組み立てる
import { build as office } from './office.js';
import { build as yard } from './yard.js';
import { build as warehouse } from './warehouse.js';
import { build as cold } from './cold.js';
import { build as radio } from './radio.js';
import { build as checkpoint } from './checkpoint.js';
import { build as freight } from './freight.js';

export const ROOMS = { office, yard, warehouse, cold, radio, checkpoint, freight };
