import {
    Dialog,
    DialogClose,
    DialogContainer,
    DialogContent,
    DialogDescription,
    DialogImage,
    DialogSubtitle,
    DialogTitle,
    DialogTrigger,
} from '@/components/dialog/dialog';
import {Button} from "@nextui-org/react";
import {Iconly} from "react-iconly";

export function DialogCard() {
    return (
        <Dialog
            transition={{
                type: 'spring',
                bounce: 0.05,
                duration: 0.25,
            }}
        >
            <DialogTrigger
                style={{
                    borderRadius: '12px',
                }}
                className='flex max-w-[270px] flex-col overflow-hidden border border-zinc-950/10 bg-white dark:border-zinc-50/10 dark:bg-zinc-900'
            >
                <DialogImage
                    src='/src/150x150.png'
                    alt='A desk lamp designed by Edouard Wilfrid Buquet in 1925. It features a double-arm design and is made from nickel-plated brass, aluminium and varnished wood.'
                    className='h-48 w-full object-cover'
                />
                <div className='flex flex-grow flex-row items-end justify-between p-2'>
                    <div>
                        <DialogTitle className='text-zinc-950 dark:text-zinc-50'>
                            Của hàng Rèm Việt
                        </DialogTitle>
                        <DialogSubtitle className='text-zinc-700 dark:text-zinc-400'>
                            831 Đ. Âu Cơ
                        </DialogSubtitle>
                    </div>
                    <Button
                        isIconOnly={true}
                    >
                        <Iconly name='Plus' set='bold' primaryColor='#000' size={24}/>
                    </Button>
                </div>
            </DialogTrigger>
            <DialogContainer>
                <DialogContent
                    style={{
                        borderRadius: '24px',
                    }}
                    className='pointer-events-auto relative flex h-fit w-fit flex-col overflow-hidden border border-zinc-950/10 bg-white dark:border-zinc-50/10 dark:bg-zinc-'
                >
                    <DialogImage
                        src='/src/150x150.png'
                        alt='abc'
                        className={""}
                    />
                    <div className='p-6'>
                        <DialogTitle className='text-2xl text-zinc-950 dark:text-zinc-50'>
                            Của hàng Rèm Việt
                        </DialogTitle>
                        <DialogSubtitle className=''>
                            831 Đ. Âu Cơ, Tân Thành, Tân Phú, Hồ Chí Minh 70000
                        </DialogSubtitle>
                        <DialogDescription
                            disableLayoutAnimation
                            variants={{
                                initial: {opacity: 0, scale: 0.8, y: 100},
                                animate: {opacity: 1, scale: 1, y: 0},
                                exit: {opacity: 0, scale: 0.8, y: 100},
                            }}
                        >
                            <div>


                            </div>
                        </DialogDescription>
                    </div>
                    <DialogClose className='text-zinc-50'/>
                </DialogContent>
            </DialogContainer>
        </Dialog>
    );
}
