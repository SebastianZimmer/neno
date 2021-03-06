import { DatabaseId } from "./DatabaseId.js";
import DatabaseNote from "./DatabaseNote.js";
import { Link } from "./Link.js";
import NodePosition from "./NodePosition.js";
import { NoteId } from "./NoteId.js";
import ScreenPosition from "./ScreenPosition.js";

export default interface DatabaseMainData {
    readonly id: DatabaseId,
    readonly creationTime: number,
    updateTime: number,
    notes: DatabaseNote[],
    links: Link[],
    idCounter: number,
    screenPosition: ScreenPosition,
    initialNodePosition: NodePosition,
    pinnedNotes: NoteId[],
}