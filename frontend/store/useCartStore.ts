import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type CartItem = {
    id: string
    name: string
    price: number
    quantity: number
}

type CartStore = {
    items: CartItem[]
    addItem: (item: CartItem) => void
    removeItem: (id: string) => void
    clearCart: () => void
    total: number
}

export const useCartStore = create<CartStore>()(
    persist(
        (set, get) => ({
            items: [],
            addItem: (item) =>
                set((state) => {
                    const existingItem = state.items.find((i) => i.id === item.id)
                    if (existingItem) {
                        return {
                            items: state.items.map((i) =>
                                i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
                            ),
                        }
                    }
                    return { items: [...state.items, { ...item, quantity: 1 }] }
                }),
            removeItem: (id) =>
                set((state) => ({
                    items: state.items.filter((i) => i.id !== id),
                })),
            clearCart: () => set({ items: [] }),
            get total() {
                return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0)
            },
        }),
        {
            name: 'cart-storage',
        }
    )
)