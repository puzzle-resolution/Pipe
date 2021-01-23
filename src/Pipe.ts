import parseTask from './parsetask';
import { replaceAnswer, submitAnswer } from './submit';
import { BlockTypeEnum, InitBlock, Position } from './types/block';
// import { State, Case } from './types/state';


const mockTask = true; //mock调试模式
const mockData = {
    taskKey: "2d31897e41e2c578",
};

// window.useRobot = true; //默认启用robot

export default class Pipe {

    getBlockType = (block: InitBlock): BlockTypeEnum => {
        const right = block || 0b0001;
        const up = block || 0b0010;
        const left = block || 0b0100;
        const down = block || 0b1000;
        const count = [up, left, down, right].filter(i => i).length;
        if (count < 1 || count > 3) {
            throw new Error(`BlockType assert: ${block}`);
        }
        return {
            1: BlockTypeEnum.Sharp1,
            2: up && down || left && right ? BlockTypeEnum.Sharp3 : BlockTypeEnum.Sharp2,
            3: BlockTypeEnum.Sharp4,
        }[count as 1 | 2 | 3];
    }
    clonePosition = (p: Position): Position => ({ ...p });
    topPosition = (p: Position): Position => this.clonePosition({ x: p.x - 1, y: p.y })
    bottomPosition = (p: Position) => this.clonePosition({ x: p.x + 1, y: p.y })
    leftPosition = (p: Position) => this.clonePosition({ x: p.x, y: p.y - 1 })
    rightPosition = (p: Position) => this.clonePosition({ x: p.x, y: p.y + 1 })


    generaterAnawer(): string {
        return '';
        // answer:string = `${status}:${check}`
        // status:string = `foreach ${pointStatus}`
        // pointStatus:0|1|2|3 定义为节点逆时针旋转的次数
        // 5和10两类节点对应的status需要将范围[0,1,2,3]映射到[0,1]
        //
        // check:string = `foreach ${pointCheck}`
        // pointCheck:0|1 定义为节点是否被锁定
        // 此处可随机生成 01序列

        // for (var t = "", e = 0; e < s.puzzleHeight; e++)
        //     for (var i = 0; i < s.puzzleWidth; i++)
        //         t += (
        //             5 == this.task[e][i] || 10 == this.task[e][i]
        //                 ? 2 == this.currentState.cellStatus[e][i]
        //                     ? 0
        //                     : 3 == this.currentState.cellStatus[e][i]
        //                         ? 1
        //                         : this.currentState.cellStatus[e][i]
        //                 : this.currentState.cellStatus[e][i]
        //         );
        // t += ":";
        // for (var e = 0; e < s.puzzleHeight; e++)
        //     for (var i = 0; i < s.puzzleWidth; i++)
        //         t += this.currentState.pinned[e][i] ? "1" : "0";
        // return t
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
        const puzzleSize: [number, number] = [4, 4];
        const taskKey: string = mockTask ? mockData.taskKey : task; //test
        // const tasks: BlockType[][] = (mockTask ? parseTask(taskKey, ...puzzleSize) as BlockType[][] : Game.task);
        const tasks = (mockTask ? parseTask(taskKey, ...puzzleSize) : Game.task);
        console.log('task', taskKey, tasks);

        // const pipe = new Pipe(tasks);
        // const timer1 = new Date;
        // const answer = pipe.solve();
        // const timer2 = new Date;
        // console.log('answer', answer);
        // console.log('耗时', timer2.valueOf() - timer1.valueOf(), 'ms');
        return;
    }


    // const onmessage = (e: MessageEvent) => {
    //     const tasks = JSON.parse(e.data);
    //     const lightup = new LightUp(tasks);
    //     const answer = lightup.solve();
    //     (postMessage as any)(answer);
    // }
    // //此处采用hack写法，需要写进所有依赖函数
    // const scriptStr = `

    //     ${LightUp.toString()} 
    //     onmessage=${onmessage.toString()}
    // `;
    // const taskKey: string = task;
    // const tasks = Game.task;
    // console.info('task', taskKey, tasks);
    // const timer1 = new Date;
    // registerWorkerWithBlob({
    //     scriptStr,
    //     postMessageStr: JSON.stringify(tasks),
    //     onMessage: (e: MessageEvent<string>) => {
    //         const timer2 = new Date;
    //         const answer = e.data;
    //         console.info('answer', answer);
    //         console.info('耗时', timer2.valueOf() - timer1.valueOf(), 'ms');
    //         replaceAnswer(answer);
    //         window.submit = submitAnswer;
    //         window.useRobot && submitAnswer();
    //     }
    // });
})();

declare global {
    interface Window {
        submit: any;
        useRobot: boolean;
    }
}