// 部屋の一覧。必要になったときに初めて組み立てる
import { build as office } from './office.js';
import { build as yard } from './yard.js';
import { build as warehouse } from './warehouse.js';

export const ROOMS = { office, yard, warehouse };
