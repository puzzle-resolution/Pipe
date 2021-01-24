import { BlockTypeEnum } from "./block";

export interface BlockStatus {
    // status: number, //0b0001 - 0b1110 已确定的状态，方向规则同task InitBlock
    sharp: BlockTypeEnum,
    status: { //四个方向已确定的状态，undefined表示未确定
        up?: boolean,
        down?: boolean,
        left?: boolean,
        right?: boolean,
    },
    locked: boolean, //节点状态是否已锁定（确定）
}

export interface State {
    //const
    // graph: InitBlock[][],
    //var
    currentRecuIndex: number,
    blockState: BlockStatus[][],
}
