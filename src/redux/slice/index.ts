import { Reducer } from "@reduxjs/toolkit";
import profile from './profile'
import projects from './projects'
import shapes from './shapes'
import viewport from './viewport'
import chat from './chat'

export const slices: Record<string, Reducer> = {
    profile,
    projects,
    shapes,
    viewport,
    chat,
}