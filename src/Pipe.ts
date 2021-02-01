import parseTask from './parsetask';
import { replaceAnswer, submitAnswer } from './submit';
import { BlockTypeEnum, InitBlock, Position } from './types/block';
import { BlockStatus, State } from './types/state';


const mockTask = false; //mock调试模式
const mockData = {
    taskKey: "2a5d4323125ec5271468e745de17d49c43d44ea8e6d7bdeb97e1ae4aeaa7e82281de828127dd33b64a1e3a23a837824c1ebc",
    puzzleSize: [10, 10],
    isCrossMap: true,
};

window.useRobot = true; //默认启用robot

type QueueType = Set<string>;
type Direction = 'up' | 'down' | 'left' | 'right';
type Case = {
    position: Position,
    directions: Direction[],
};

export default class Pipe {
    graph: InitBlock[][];
    isCrossMap: boolean;
    floorEntry: Position;
    answer?: string;
    constructor(graph: InitBlock[][], isCrossMap: boolean) {
        this.graph = graph;
        this.isCrossMap = isCrossMap;
        this.floorEntry = {
            x: Math.floor(graph.length / 2),
            y: Math.floor(graph[0].length / 2),
        };
    }

    initState = (graph: InitBlock[][]) => {
        let blockState = graph.map(list => list.map(p => ({ sharp: this.getBlockType(p), status: {}, locked: false })));
        return { blockState };
    }

    getBlockType = (block: InitBlock): BlockTypeEnum => {
        const right = !!(block & 0b0001);
        const up = !!(block & 0b0010);
        const left = !!(block & 0b0100);
        const down = !!(block & 0b1000);
        const count = [up, left, down, right].filter(i => i).length;
        if (count < 1 || count > 3) {
            throw new Error(`BlockType assert: ${block}`);
        }
        return {
            1: BlockTypeEnum.Sharp1,
            2: up && down || left && right ? BlockTypeEnum.Sharp2 : BlockTypeEnum.Sharp3,
            3: BlockTypeEnum.Sharp4,
        }[count as 1 | 2 | 3];
    }
    clonePosition = (p: Position): Position => ({ ...p });
    checkPositionEqual = (p: Position, q: Position): boolean => (p.x === q.x && p.y === q.y)
    topPosition = (p: Position): Position => this.clonePosition({ x: p.x == 0 ? this.graph.length - 1 : p.x - 1, y: p.y })
    bottomPosition = (p: Position) => this.clonePosition({ x: p.x == this.graph.length - 1 ? 0 : p.x + 1, y: p.y })
    leftPosition = (p: Position) => this.clonePosition({ x: p.x, y: p.y == 0 ? this.graph[0].length - 1 : p.y - 1 })
    rightPosition = (p: Position) => this.clonePosition({ x: p.x, y: p.y == this.graph[0].length - 1 ? 0 : p.y + 1 })

    oppositeDirection = (direction: Direction) => {
        const directions: Direction[] = ['up', 'left', 'down', 'right'];
        return directions[(directions.indexOf(direction) + 2) % 4];
    }
    directionPositionReducer = (direction: Direction) => {
        switch (direction) {
            case 'up': return this.topPosition;
            case 'down': return this.bottomPosition;
            case 'left': return this.leftPosition;
            case 'right': return this.rightPosition;
            default: throw new Error("direction param illegal assert");
        }
    }

    // cloneState = function <T extends Object>(arr: T[][]) { //深拷贝二维数组
    //     return arr.map(a => a.map(b => b));
    // }
    cloneState = function <T extends Object>(arr: T[][]) { //深拷贝二维对象数组
        return arr.map(a => a.map(b => JSON.parse(JSON.stringify(b))));
    }
    checkBoundary = (p: Position): boolean => {
        return !(p.x < 0 || p.x >= this.graph.length || p.y < 0 || p.y >= this.graph[0].length);
    }

    appendToUpdateQueue(data: State, queue: QueueType, points: Position[]): boolean { //将p插入等待队列
        for (let { x, y } of points) {
            const queueKey = `${x},${y}`;
            //去重
            if (queue.has(queueKey)) { continue; }
            //校验位置是否完成
            if (this.isSolvedPosition(data, this.clonePosition({ x, y }))) { continue; }
            //添加到队列
            queue.add(queueKey);
        }
        return true;
    }
    clearUpdateQueue(data: State, queue: QueueType): boolean { //清空等待队列
        let count = 0;
        try {
            while (queue.size > 0) {
                const pos = [...queue.keys()][0];
                queue.delete(pos);
                console.log('clear queue', count++, pos);

                const [x, y] = pos.split(',').map(i => +i);
                if (!this.updatePoint(data, queue, this.clonePosition({ x, y }))) {
                    return false;
                }
            }
        } catch (err) {
            console.error('clear queue error', err);
            return false;
        }
        return true;
    }

    lockPointDirectionStatus = (direction: Direction, data: State, queue: QueueType, p: Position, status: boolean) => {
        const q = this.directionPositionReducer(direction)(p);
        const qDirection = this.oppositeDirection(direction);
        const pStatus = data.blockState[p.x][p.y].status[direction],
            qStatus = data.blockState[q.x][q.y].status[qDirection];
        if (pStatus !== undefined && qStatus !== undefined && pStatus !== qStatus) { return false; }
        else if ((pStatus !== undefined && pStatus !== status) || (qStatus !== undefined && qStatus !== status)) { return false; }
        else {
            if (pStatus === undefined) {
                data.blockState[p.x][p.y].status[direction] = status;
                this.appendToUpdateQueue(data, queue, [this.clonePosition(p)]);
            }
            if (qStatus === undefined) {
                data.blockState[q.x][q.y].status[qDirection] = status;
                this.appendToUpdateQueue(data, queue, [this.clonePosition(q)]);
            }
            return true;
        }
    }
    lockPointUpStatus = this.lockPointDirectionStatus.bind(null, 'up');
    lockPointDownStatus = this.lockPointDirectionStatus.bind(null, 'down');
    lockPointLeftStatus = this.lockPointDirectionStatus.bind(null, 'left');
    lockPointRightStatus = this.lockPointDirectionStatus.bind(null, 'right');

    applyNeighborLink = (status: boolean, p: Position, q: Position, data: State, queue: QueueType) => { //相邻两节点间连接
        if (this.checkPositionEqual(this.topPosition(p), q)) {
            return this.lockPointUpStatus(data, queue, p, status);
        } else if (this.checkPositionEqual(this.bottomPosition(p), q)) {
            return this.lockPointDownStatus(data, queue, p, status);
        } if (this.checkPositionEqual(this.leftPosition(p), q)) {
            return this.lockPointLeftStatus(data, queue, p, status);
        } if (this.checkPositionEqual(this.rightPosition(p), q)) {
            return this.lockPointRightStatus(data, queue, p, status);
        }
        throw new Error('Nodes are not adjacent assert');
    }
    checkNeighborLink = this.applyNeighborLink.bind(null, true); //选择相邻两节点间连接
    disableNeighborLink = this.applyNeighborLink.bind(null, false); //禁用相邻两节点间连接

    isSolvedPosition = (data: State, p: Position): boolean => {
        const status = data.blockState[p.x][p.y]
        return status.locked;
    }

    aroundTRBL(p: Position, applyCondition: (p: Position) => boolean = () => (true)): Partial<[Position, Position, Position, Position]> { //返回任意位置周围四个位置，满足applyCondition条件的位置
        let result = [undefined, undefined, undefined, undefined] as Partial<[Position, Position, Position, Position]>;
        const top = this.topPosition(p);
        if (applyCondition(this.clonePosition(top))) { result[0] = top; }
        const right = this.rightPosition(p);
        if (applyCondition(this.clonePosition(right))) { result[1] = right; }
        const bottom = this.bottomPosition(p);
        if (applyCondition(this.clonePosition(bottom))) { result[2] = bottom; }
        const left = this.leftPosition(p);
        if (applyCondition(this.clonePosition(left))) { result[3] = left; }
        return result;
    }

    getDirectionLink = (data: State, p: Position, q: Position): boolean | undefined => { //获取两相邻节点的方向状态
        const states = data.blockState, pStatus = states[p.x][p.y].status, qStatus = states[q.x][q.y].status;
        if (this.checkPositionEqual(this.topPosition(p), q)) {
            return pStatus.up;
        } else if (this.checkPositionEqual(this.bottomPosition(p), q)) {
            return pStatus.down;
        } if (this.checkPositionEqual(this.leftPosition(p), q)) {
            return pStatus.left;
        } if (this.checkPositionEqual(this.rightPosition(p), q)) {
            return pStatus.right;
        }
        throw new Error('Nodes are not adjacent assert');
    }
    checkDirectionLink = (data: State, p: Position, q: Position): boolean => { //判断两相邻节点的方向状态等价情况
        const check = (a?: boolean, b?: boolean) => a === undefined || b === undefined || a === b
        const states = data.blockState, pStatus = states[p.x][p.y].status, qStatus = states[q.x][q.y].status;
        if (this.checkPositionEqual(this.topPosition(p), q)) {
            return check(pStatus.up, qStatus.down);
        } else if (this.checkPositionEqual(this.bottomPosition(p), q)) {
            return check(pStatus.down, qStatus.up);
        } if (this.checkPositionEqual(this.leftPosition(p), q)) {
            return check(pStatus.left, qStatus.right);
        } if (this.checkPositionEqual(this.rightPosition(p), q)) {
            return check(pStatus.right, qStatus.left);
        }
        throw new Error('Nodes are not adjacent assert');
    }
    asynDirectionLink = (data: State, queue: QueueType, p: Position): boolean => { //同步四周节点的方向状态
        const { status: { up, down, left, right } } = data.blockState[p.x][p.y];
        const upPosition = this.topPosition(p), upState = data.blockState[upPosition.x][upPosition.y],
            downPosition = this.bottomPosition(p), downState = data.blockState[downPosition.x][downPosition.y],
            leftPosition = this.leftPosition(p), leftState = data.blockState[leftPosition.x][leftPosition.y],
            rightPosition = this.rightPosition(p), rightState = data.blockState[rightPosition.x][rightPosition.y];
        if (upState.status.down !== undefined) {
            if (up === undefined) {
                if (!this.lockPointUpStatus(data, queue, p, upState.status.down)) { return false; }
            }
            else if (up !== upState.status.down) { return false;/*throw new Error('direction status link assert')*/ }
        }
        if (downState.status.up !== undefined) {
            if (down === undefined) {
                if (!this.lockPointDownStatus(data, queue, p, downState.status.up)) { return false; }
            }
            else if (down !== downState.status.up) { return false; }
        }
        if (leftState.status.right !== undefined) {
            if (left === undefined) {
                if (!this.lockPointLeftStatus(data, queue, p, leftState.status.right)) { return false; }
            }
            else if (left !== leftState.status.right) { return false; }
        }
        if (rightState.status.left !== undefined) {
            if (right === undefined) {
                if (!this.lockPointRightStatus(data, queue, p, rightState.status.left)) { return false; }
            }
            else if (right !== rightState.status.left) { return false; }
        }
        return true;
    }
    updatePoint = (data: State, queue: QueueType, p: Position): boolean => { //更新节点状态；更新节点方向状态；处理四周节点
        //判断节点是否完成
        if (this.isSolvedPosition(data, p)) { return true; }

        // //同步四周节点的方向状态 //改为lock时同步
        // if (!this.asynDirectionLink(data, queue, p)) { return false; }

        const { blockState } = data;
        const { x, y } = p;
        const state = blockState[x][y];
        const { sharp, status: { up, down, left, right } } = state;
        //根据当前状态，更新等价的方向节点状态
        const directionTotal = { [BlockTypeEnum.Sharp1]: 1, [BlockTypeEnum.Sharp2]: 2, [BlockTypeEnum.Sharp3]: 2, [BlockTypeEnum.Sharp4]: 3 }[sharp];
        const directCurrTrueCnt = [up, left, down, right].filter(i => i === true).length;
        const directCurrFalseCnt = [up, left, down, right].filter(i => i === false).length;
        // const directCurrResCnt = [up, left, down, right].filter(i => i === undefined).length;
        if (directCurrTrueCnt > directionTotal || directCurrFalseCnt > 4 - directionTotal) {
            // throw new Error('direction cnt assert');
            return false;
        } else if (directCurrTrueCnt === directionTotal) {
            if (sharp === BlockTypeEnum.Sharp2 && (up !== undefined && down !== undefined && up !== down || left !== undefined && right !== undefined && left !== right)) { return false; }
            if (sharp === BlockTypeEnum.Sharp3 && (up && down || left && right)) { return false; }
            //更新其余未完成的方向状态为 false
            if (up === undefined) if (!this.lockPointUpStatus(data, queue, p, false)) { return false; }
            if (down === undefined) if (!this.lockPointDownStatus(data, queue, p, false)) { return false; }
            if (left === undefined) if (!this.lockPointLeftStatus(data, queue, p, false)) { return false; }
            if (right === undefined) if (!this.lockPointRightStatus(data, queue, p, false)) { return false; }
            //更新节点完成标志
            blockState[x][y].locked = true;
        } else if (directCurrFalseCnt === 4 - directionTotal) {
            if (sharp === BlockTypeEnum.Sharp2 && ((up === false) !== (down === false) || (left === false) !== (right === false))) { return false; }
            if (sharp === BlockTypeEnum.Sharp3 && (up === false && down === false || left === false && right === false)) { return false; }
            //更新其余未完成的方向状态为 true
            if (up === undefined) if (!this.lockPointUpStatus(data, queue, p, true)) { return false; }
            if (down === undefined) if (!this.lockPointDownStatus(data, queue, p, true)) { return false; }
            if (left === undefined) if (!this.lockPointLeftStatus(data, queue, p, true)) { return false; }
            if (right === undefined) if (!this.lockPointRightStatus(data, queue, p, true)) { return false; }
            //更新节点完成标志
            blockState[x][y].locked = true;
        } else {
            const dirMap: Direction[] = ['up', 'left', 'down', 'right'];
            if (sharp === BlockTypeEnum.Sharp1) {
                // directCurrTrueCnt: 0
                // directCurrFalseCnt: 0-2
                // nothing to do 
            } else if (sharp === BlockTypeEnum.Sharp2) {
                // directCurrTrueCnt: 0-1
                // directCurrFalseCnt: 0-1
                if (directCurrTrueCnt == 1) {
                    const truePos = [up, left, down, right].findIndex(i => i === true);
                    if (!this.lockPointDirectionStatus(dirMap[(truePos + 2) % 4], data, queue, p, true)) { return false; }
                    if (!this.lockPointDirectionStatus(dirMap[(truePos + 1) % 4], data, queue, p, false)) { return false; }
                    if (!this.lockPointDirectionStatus(dirMap[(truePos + 3) % 4], data, queue, p, false)) { return false; }
                    //更新节点完成标志
                    blockState[x][y].locked = true;
                } else if (directCurrFalseCnt == 1) {
                    const falsePos = [up, left, down, right].findIndex(i => i === false);
                    if (!this.lockPointDirectionStatus(dirMap[(falsePos + 2) % 4], data, queue, p, false)) { return false; }
                    if (!this.lockPointDirectionStatus(dirMap[(falsePos + 1) % 4], data, queue, p, true)) { return false; }
                    if (!this.lockPointDirectionStatus(dirMap[(falsePos + 3) % 4], data, queue, p, true)) { return false; }
                    //更新节点完成标志
                    blockState[x][y].locked = true;
                }
            } else if (sharp === BlockTypeEnum.Sharp3) {
                if (directCurrFalseCnt == 1) {
                    const falsePos = [up, left, down, right].findIndex(i => i === false);
                    if (!this.lockPointDirectionStatus(dirMap[(falsePos + 2) % 4], data, queue, p, true)) { return false; }
                }
                if (directCurrTrueCnt == 1) {
                    const truePos = [up, left, down, right].findIndex(i => i === true);
                    if (!this.lockPointDirectionStatus(dirMap[(truePos + 2) % 4], data, queue, p, false)) { return false; }
                }
            } else if (sharp === BlockTypeEnum.Sharp4) {
                // directCurrTrueCnt: 0-2
                // directCurrFalseCnt: 0
                // nothing to do 
            }
        }

        //判断四周节点状态
        //性能太差，且存在死循环，改在lock位置只添加状态改变的节点
        // const aroundPositions = this.aroundTRBL(p);
        // for (let position of aroundPositions.values()) {
        //     if (position && this.checkBoundary(position)) {
        //         //获取相邻节点，相邻方向的状态，判断等价情况
        //         //若冲突，抛出错误
        //         //否则 若相邻节点未完成，则添加相邻节点至队列
        //         if (this.checkDirectionLink(data, p, position)) {
        //             if (!this.isSolvedPosition(data, position)) {
        //                 this.appendToUpdateQueue(data, queue, [this.clonePosition(position)]);
        //             }
        //         } else { return false; }
        //     }
        // }

        return true;
    }

    updateAroudState = (data: State, queue: QueueType): boolean => {// 初始化边界，非跨边模式的逻辑
        for (let x of this.graph.keys()) {
            this.lockPointLeftStatus(data, queue, { x, y: 0 }, false);
            this.lockPointRightStatus(data, queue, { x, y: this.graph[0].length - 1 }, false);
        }
        for (let y of this.graph[0].keys()) {
            this.lockPointUpStatus(data, queue, { x: 0, y }, false);
            this.lockPointDownStatus(data, queue, { x: this.graph.length - 1, y }, false);
        }
        return true;
    }
    updateCutInCases = (data: State, queue: QueueType): boolean => {// 基于几类简单的规则，初始化部分节点状态，作为切入点
        const { blockState } = data;

        for (let x of this.graph.keys())
            for (let y of this.graph[0].keys()) {
                if (blockState[x][y].sharp === BlockTypeEnum.Sharp1) {
                    //1. 相邻的Sharp1节点，不可连接
                    this.aroundTRBL({ x, y }, (p) => blockState[p.x][p.y].sharp === BlockTypeEnum.Sharp1)
                        .map(p => {
                            if (p) if (!this.disableNeighborLink({ x, y }, p, data, queue)) { return false; }
                        });
                } else if (blockState[x][y].sharp === BlockTypeEnum.Sharp2) {
                    //2. 形如 Sharp1 - Sharp2(*n) - Sharp1 不可连接
                    const testIsDirectToSharp1 = (direction: Direction) => {
                        const next = this.directionPositionReducer(direction);
                        const p = { x, y };
                        let q = this.clonePosition(p);
                        do {
                            q = next(q);
                            if (this.checkPositionEqual(p, q)) { return true; } //整行或整列的sharp2的场景,出现封闭集合

                            const sharp = blockState[q.x][q.y].sharp;
                            if (sharp === BlockTypeEnum.Sharp1) { return true; }
                            else if (sharp === BlockTypeEnum.Sharp2) { }
                            else { return false; }
                        } while (1);
                    }

                    if (testIsDirectToSharp1('up') && testIsDirectToSharp1('down')) {
                        if (!this.lockPointUpStatus(data, queue, { x, y }, false)) { return false; }
                    } else if (testIsDirectToSharp1('left') && testIsDirectToSharp1('right')) {
                        if (!this.lockPointLeftStatus(data, queue, { x, y }, false)) { return false; }
                    }
                }
            }

        return true;
    }

    updateCases = (data: State): 1 | 2 | false => {
        const state = data.blockState;
        //遍历未完成节点
        for (let x of this.graph.keys())
            for (let y of this.graph[0].keys()) {
                if (!state[x][y].locked) {
                    const p = { x, y };
                    const pSet = this.generateSet(data, this.clonePosition(p));
                    const neighbors = this.aroundTRBL(p).filter(i => i && !state[i.x][i.y].locked) as Position[];
                    for (let q of neighbors) {
                        if (pSet.exportPoints.has(`${q.x}_${q.y}`)) {
                            let queue = new Set<string>();
                            if (!this.disableNeighborLink(p, q, data, queue)) { return false; }
                            if (!this.clearUpdateQueue(data, queue)) { return false; }
                            return 1;
                        }
                    }
                    if (pSet.exportPoints.size == 1) { //所属集合仅有单个开放点
                        const [ePx, ePy] = [...pSet.exportPoints.values()][0].split('_');
                        let eP = { x: +ePx, y: +ePy };
                        if (this.checkPositionEqual(p, eP)) {
                            for (let q of neighbors) {
                                if (this.getDirectionLink(data, p, q) !== undefined) { continue; }

                                const qSet = this.generateSet(data, this.clonePosition(q));
                                const floorPointStr = `${this.floorEntry.x}_${this.floorEntry.y}`;
                                if (pSet.exportPoints.size === 1
                                    && qSet.exportPoints.size === 1
                                    && !pSet.lockedPoints.has(floorPointStr)
                                    && !qSet.lockedPoints.has(floorPointStr)) { //两者都不包含水流起点，相连会生成封闭集合

                                    const positionRest = (data: State, position: Position) => {
                                        const posState = data.blockState[position.x][position.y];
                                        const totalMap = { [BlockTypeEnum.Sharp1]: 1, [BlockTypeEnum.Sharp2]: 2, [BlockTypeEnum.Sharp3]: 2, [BlockTypeEnum.Sharp4]: 3 };
                                        const upPos = this.topPosition(position);
                                        const downPos = this.bottomPosition(position);
                                        const leftPos = this.leftPosition(position);
                                        const rightPos = this.rightPosition(position);

                                        let linkedPoints = 0;
                                        posState.status.up && data.blockState[upPos.x][upPos.y].locked && linkedPoints++;
                                        posState.status.down && data.blockState[downPos.x][downPos.y].locked && linkedPoints++;
                                        posState.status.left && data.blockState[leftPos.x][leftPos.y].locked && linkedPoints++;
                                        posState.status.right && data.blockState[rightPos.x][rightPos.y].locked && linkedPoints++;
                                        return totalMap[posState.sharp] - linkedPoints;
                                    }
                                    if (positionRest(data, p) === 1 && positionRest(data, q) === 1) {
                                        let queue = new Set<string>();
                                        if (!this.disableNeighborLink(p, q, data, queue)) { return false; }
                                        if (!this.clearUpdateQueue(data, queue)) { return false; }
                                        return 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        return 2;
    }
    findNext = (data: State): Position | false => { //寻找一个未完成的节点
        for (let x of this.graph.keys())
            for (let y of this.graph[0].keys()) {
                if (!data.blockState[x][y].locked) {
                    return { x, y };
                }
            }
        return false;
    }
    getCases = (data: State, p: Position): Case[] => {
        const { x, y } = p, status = data.blockState[x][y];
        if (status.locked) { return []; }

        const { sharp, status: { up, down, left, right } } = status;
        const directionTotal = { [BlockTypeEnum.Sharp1]: 1, [BlockTypeEnum.Sharp2]: 2, [BlockTypeEnum.Sharp3]: 2, [BlockTypeEnum.Sharp4]: 3 }[sharp];
        const directCurrTrueCnt = [up, left, down, right].filter(i => i === true).length;
        const directCurrFalseCnt = [up, left, down, right].filter(i => i === false).length;
        if (sharp === BlockTypeEnum.Sharp1) {
            if (directCurrTrueCnt >= 1) { return []; }
            let res: Case[] = [];
            up === undefined && res.push({ position: this.clonePosition(p), directions: ['up'] });
            down === undefined && res.push({ position: this.clonePosition(p), directions: ['down'] });
            left === undefined && res.push({ position: this.clonePosition(p), directions: ['left'] });
            right === undefined && res.push({ position: this.clonePosition(p), directions: ['right'] });
            return res;
        } else if (sharp === BlockTypeEnum.Sharp2) {
            if (directCurrTrueCnt >= 1 || directCurrFalseCnt >= 1) { return []; }
            let res: Case[] = [];
            res.push({ position: this.clonePosition(p), directions: ['up', 'down'] });
            res.push({ position: this.clonePosition(p), directions: ['left', 'right'] });
            return res;
        } else if (sharp === BlockTypeEnum.Sharp3) {
            if (directCurrTrueCnt >= 2 || directCurrFalseCnt >= 2) { return []; }
            let res: Case[] = [];
            if (up === undefined || down === undefined) {
                if (left === undefined && right === undefined) {
                    res.push({ position: this.clonePosition(p), directions: ['up', 'left'] });
                    res.push({ position: this.clonePosition(p), directions: ['down', 'left'] });
                    res.push({ position: this.clonePosition(p), directions: ['up', 'right'] });
                    res.push({ position: this.clonePosition(p), directions: ['down', 'right'] });
                } else {
                    up === undefined && res.push({ position: this.clonePosition(p), directions: ['up'] });
                    down === undefined && res.push({ position: this.clonePosition(p), directions: ['down'] });
                }
            } else {
                left === undefined && res.push({ position: this.clonePosition(p), directions: ['left'] });
                right === undefined && res.push({ position: this.clonePosition(p), directions: ['right'] });
            }
            return res;
        } else if (sharp === BlockTypeEnum.Sharp4) {
            if (directCurrTrueCnt >= 3 || directCurrFalseCnt >= 1) { return []; }
            let res: Case[] = [];
            up === undefined && res.push({ position: this.clonePosition(p), directions: ['up'] });
            down === undefined && res.push({ position: this.clonePosition(p), directions: ['down'] });
            left === undefined && res.push({ position: this.clonePosition(p), directions: ['left'] });
            right === undefined && res.push({ position: this.clonePosition(p), directions: ['right'] });
            return res;
        }
        return [];
    }
    applyCase = (data: State, ca: Case) => {
        const { position, directions } = ca;
        let queue = new Set<string>();
        for (let dir of directions) {
            if (!this.lockPointDirectionStatus(dir, data, queue, position, true)) {
                return false;
            }
        }
        if (!this.clearUpdateQueue(data, queue)) { return false; }
        return true;
    }
    recu = (data: State): State | false => {
        //推导已知情况
        let cnt = 0;
        do {
            const res = this.updateCases(data);
            if (res === false) { //更新动作失败
                return false;
            }
            else if (res === 2) { //未做更新动作
                if (this.verificate(data)) {
                    return data; //返回答案
                } else {
                    break;
                }
            }
            console.log(`recu time: ${cnt++}`)
        } while (1);

        //若不存在可推导情况，选择节点方案递归处理
        const p = this.findNext(data);
        if (p) {
            const cases = this.getCases(data, p);
            for (let ca of cases) {
                const nextState = {
                    blockState: this.cloneState(data.blockState),
                    currentRecuIndex: data.currentRecuIndex + 1,
                }
                if (this.applyCase(nextState, ca)) {
                    const res = this.recu(nextState);
                    if (res) { return res; }
                }
            }
        } else {
            if (this.verificate(data)) { return data; }
            else { return false; }
        }

        return false;
    }
    solve = (): string => {
        const { blockState } = this.initState(this.graph);
        let result: State | false = { blockState, currentRecuIndex: 0 };
        let queue = new Set<string>();
        if (!this.isCrossMap) { //非跨边模式，先初始化边界
            this.updateAroudState(result, queue);
        }
        this.updateCutInCases(result, queue);
        this.clearUpdateQueue(result, queue);

        if (!this.verificate(result)) {
            result = this.recu({
                blockState: this.cloneState(blockState),
                currentRecuIndex: 0,
            });
        }

        return (this.answer = (result ? this.generaterAnawer(result.blockState) : 'failed'));
    }


    verificate(data: State): boolean {
        const set = this.generateSet(data, { x: 0, y: 0 });
        //节点是否全连通
        if (set.lockedPoints.size !== this.graph.length * this.graph[0].length) { return false; }
        //节点是否不存在回路
        if (set.hasLoop) { return false; }
        //每个节点与相邻节点对应方向上的状态是否等价（循环判断右和下）
        for (let x of this.graph.keys())
            for (let y of this.graph[0].keys()) {
                const { blockState } = data;
                const pStatus = blockState[x][y].status;
                const right = this.rightPosition({ x, y }), rStatus = blockState[right.x][right.y].status;
                const bottom = this.bottomPosition({ x, y }), bStatus = blockState[bottom.x][bottom.y].status;
                if (pStatus.right !== rStatus.left || pStatus.down !== bStatus.up) { return false; }
            }
        return true;
    }
    generaterAnawer = (blockState: State['blockState']): string => {
        // return '';
        // answer:string = `${status}:${check}`
        // status:string = `foreach ${pointStatus}`
        // pointStatus:0|1|2|3 定义为节点逆时针旋转的次数
        // 5和10两类节点对应的status需要将范围[0,1,2,3]映射到[0,1]
        //
        // check:string = `foreach ${pointCheck}`
        // pointCheck:0|1 定义为节点是否被锁定
        // 此处可随机生成 01序列 或 生成 全1序列

        const calcStatusNumber = (status: State['blockState'][number][number]['status']) => {
            const { up, down, left, right } = status;
            let res = 0;
            if (right) res |= 0b0001;
            if (up) res |= 0b0010;
            if (left) res |= 0b0100;
            if (down) res |= 0b1000;
            return res;
        }
        const getBlockAnawerStatus = (origin: number, after: number): 0 | 1 | 2 | 3 => { //获取节点逆时针旋转次数
            const next = (res: number) => {
                const b0 = +!!(res & 0b0001);
                const b1 = +!!(res & 0b0010);
                const b2 = +!!(res & 0b0100);
                const b3 = +!!(res & 0b1000);
                return b2 * 0b1000 + b1 * 0b0100 + b0 * 0b0010 + b3 * 0b0001;
            }
            let cnt = 0, res = origin;
            while (res != after) {
                res = next(res);
                cnt++;
                if (cnt > 3) { throw new Error(`next cnt limit excceded: ${origin},${after},${cnt}>3`) }
            }
            return cnt % 4 as 0 | 1 | 2 | 3;
        }
        let ans = "";
        for (let x of this.graph.keys())
            for (let y of this.graph[0].keys()) {
                const status = getBlockAnawerStatus(this.graph[x][y], calcStatusNumber(blockState[x][y].status));
                const type = this.getBlockType(this.graph[x][y]);
                ans += (
                    type == BlockTypeEnum.Sharp2
                        ? { 0: 0, 1: 1, 2: 0, 3: 1 }[status]
                        : status
                );
            }
        ans += ':';
        // for (let x of this.graph.keys())
        //     for (let y of this.graph[0].keys())
        //         ans += '1';
        ans += Array(this.graph.length * this.graph[0].length).fill(1).join('');
        return ans;
    }

    //生成entry所属的集合信息
    generateSet = (data: State, entry: Position) => {
        const states = data.blockState;
        let points = new Set<string>(); //`${p.x}_${p.y}`
        let edges = new Set<string>(); //`${p},${q}`

        //bfs 生成点集 边集
        const formatPoint = (p: Position) => `${p.x}_${p.y}`
        const formatEdge = (p: Position, q: Position) => {
            const [pSm, pBg] = p.x < q.x ? [p, q] : p.x > q.x ? [q, p] : p.y < q.y ? [p, q] : [q, p];
            return `${formatPoint(pSm)},${formatPoint(pBg)}`
        }

        let bfsQueue = [entry];
        do {
            const p = bfsQueue.shift()!;
            const pStr = formatPoint(p);
            if (!points.has(pStr)) {
                points.add(pStr);

                const addPoint = (q: Position) => {
                    bfsQueue.push(q);
                    const edgeStr = formatEdge(p, q);
                    if (!edges.has(edgeStr)) {
                        edges.add(edgeStr);
                    }
                }
                const { status: { up, down, left, right } } = states[p.x][p.y];
                up && this.isSolvedPosition(data, this.topPosition(p)) && addPoint(this.topPosition(p));
                down && this.isSolvedPosition(data, this.bottomPosition(p)) && addPoint(this.bottomPosition(p));
                left && this.isSolvedPosition(data, this.leftPosition(p)) && addPoint(this.leftPosition(p));
                right && this.isSolvedPosition(data, this.rightPosition(p)) && addPoint(this.rightPosition(p));
            }
        } while (bfsQueue.length > 0);

        //遍历边，构造并查集 判断回路
        let hasLoop = false;
        if (edges.size >= points.size) {
            hasLoop = true;
        } else {
            const calc = () => {
                let father: { [key in string]: string } = {}, g = [];

                for (let p of points.values()) {
                    father[p] = p;
                }
                for (let e of edges.values()) {
                    const [p, q] = e.split(',');
                    g.push({ p, q });
                }
                const find = (x: string) => {
                    let a = x;
                    while (x != father[x]) {
                        x = father[x];
                    }
                    while (a != father[a]) {
                        let z = a;
                        a = father[a];
                        father[z] = x;
                    }
                    return x;
                }
                const union = (a: string, b: string) => {
                    const fa = find(a);
                    const fb = find(b);
                    father[a] = father[b] = fa;//min(fa, fb);
                }
                for (let i of g) {
                    const { p, q } = i;
                    if (father[p] == father[q]) {
                        return true;
                    }
                    union(p, q);
                }
                return false;
            };
            hasLoop = calc();
        }

        let exportPoints = new Set<string>();
        let lockedPoints = new Set<string>(); //`${p.x}_${p.y}`
        for (let p of points.values()) {
            const [x, y] = p.split('_');
            if (states[+x][+y].locked) {
                lockedPoints.add(p);
            } else {
                exportPoints.add(p);
            }
        }

        for (let p of lockedPoints) {
            const [sx, sy] = p.split('_'), x = +sx, y = +sy;
            const { status: { up, down, left, right } } = states[x][y];
            const upPos = this.topPosition({ x, y });
            const downPos = this.bottomPosition({ x, y });
            const leftPos = this.leftPosition({ x, y });
            const rightPos = this.rightPosition({ x, y });
            if (up && !states[upPos.x][upPos.y].locked) { exportPoints.add(formatPoint(upPos)); }
            if (down && !states[downPos.x][downPos.y].locked) { exportPoints.add(formatPoint(downPos)); }
            if (left && !states[leftPos.x][leftPos.y].locked) { exportPoints.add(formatPoint(leftPos)); }
            if (right && !states[rightPos.x][rightPos.y].locked) { exportPoints.add(formatPoint(rightPos)); }
        }

        return { lockedPoints, edges, hasLoop, exportPoints };
    }
}

function registerWorkerWithBlob(config: {
    scriptStr: string,
    postMessageStr: string;
    onMessage: (this: Worker, ev: MessageEvent) => any,
}) {
    const { scriptStr, postMessageStr, onMessage } = config;
    const blob = new Blob([scriptStr], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    worker.onmessage = onMessage;
    worker.postMessage(postMessageStr);
}

(() => {
    console.log('start');
    if (mockTask) {
        const { puzzleSize, taskKey, isCrossMap } = mockData;
        const tasks: InitBlock[][] = parseTask(taskKey, ...puzzleSize as [number, number]);
        console.info('task', taskKey, tasks);

        const pipe = new Pipe(tasks, isCrossMap);
        const timer1 = new Date;
        const answer = pipe.solve();
        const timer2 = new Date;
        console.info('answer', answer);
        console.info('耗时', timer2.valueOf() - timer1.valueOf(), 'ms');
        return;
    }


    const onmessage = (e: MessageEvent) => {
        const { tasks, isCrossMap } = JSON.parse(e.data);
        const pipe = new Pipe(tasks, isCrossMap);
        const answer = pipe.solve();
        (postMessage as any)(answer);
    }
    //此处采用hack写法，需要写进所有依赖函数
    const scriptStr = `

        ${Pipe.toString()} 
        onmessage=${onmessage.toString()}
    `;

    const isCrossMap = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19].includes(Game.plSize);
    const taskKey: string = task;
    const tasks = Game.task;
    console.info('task', taskKey, tasks);
    const timer1 = new Date;
    registerWorkerWithBlob({
        scriptStr,
        postMessageStr: JSON.stringify({ tasks, isCrossMap }),
        onMessage: (e: MessageEvent<string>) => {
            const timer2 = new Date;
            const answer = e.data;
            console.info('answer', answer);
            console.info('耗时', timer2.valueOf() - timer1.valueOf(), 'ms');
            replaceAnswer(answer);
            window.submit = submitAnswer;
            window.useRobot && submitAnswer();
        }
    });
})();

declare global {
    interface Window {
        submit: any;
        useRobot: boolean;
    }
}