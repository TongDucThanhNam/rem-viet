import {useStore} from '@nanostores/react';
import {Button} from '@nextui-org/button';
import {darkTheme, isThemeReady, theme, toggleTheme} from '@/store/theme.ts';
import {useEffect, useState} from 'react';
import {MoonFilledIcon, SunFilledIcon} from "@/components/icons/icons";

interface Props {
    asLink?: boolean;
}

export default (props: Props) => {
    const $theme = useStore(theme);
    const $isThemeReady = useStore(isThemeReady);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const icon = (
        $theme === darkTheme ? <SunFilledIcon/> : <MoonFilledIcon/>
    );

    const ariaLabel = $theme === darkTheme ? 'Switch to light theme' : 'Switch to dark theme';

    return <Button
        isIconOnly
        variant={"light"}
        onPress={toggleTheme}
        aria-label={ariaLabel}>
        {icon}
    </Button>

};