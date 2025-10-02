const storageKey = 'theme-preference'

const onClick = () => {
    // flip current value
    theme.value = theme.value === 'cipher-light'
        ? 'dark'
        : 'cipher-light'

    setPreference()
}

const getColorPreference = () => {
    if (localStorage.getItem(storageKey))
        return localStorage.getItem(storageKey)
    else
        return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'cipher-light'
}

const setPreference = () => {
    localStorage.setItem(storageKey, theme.value)
    reflectPreference()
}

const reflectPreference = () => {
    document.firstElementChild
        .setAttribute('data-theme', theme.value)

    document.querySelectorAll('.theme-toggle').forEach(button => {
        button.setAttribute('aria-label', theme.value === 'cipher-light' ? 'light' : 'dark')
    })
}

const theme = {
    value: getColorPreference(),
}

// set early so no page flashes / CSS is made aware
reflectPreference()

// Use DOMContentLoaded to ensure buttons are available
document.addEventListener('DOMContentLoaded', () => {
    // set on load so screen readers can see latest value on the button
    reflectPreference()

    // now this script can find and listen for clicks on the control
    document.querySelectorAll('.theme-toggle').forEach(button => {
        button.addEventListener('click', onClick)
    })
});

// sync with system changes
window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', ({matches:isDark}) => {
        theme.value = isDark ? 'dark' : 'cipher-light'
        setPreference()
    })