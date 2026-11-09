// V8 发动机 · 互动页入口
import {createSim} from '../shared/sim.js';
import {startSim} from '../../../../../../shared/mechanical/deepseek-kit/player.js';
startSim(createSim({mode: 'live'}), {mode: 'live'});
