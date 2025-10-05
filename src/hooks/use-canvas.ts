import { AppDispatch, useAppSelector } from "@/redux/store"
import { useDispatch } from "react-redux"

export const useCanvas = () => {
    const dispatch = useDispatch<AppDispatch>()

    const viewport = useAppSelector((state) => state.viewport)
    const entityState = useAppSelector((state) => state.shapes.shapes)

}