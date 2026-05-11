import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const path = request.nextUrl.pathname

    // Allow unauthenticated access to auth-related routes
    if (
        !user &&
        !path.startsWith('/login') &&
        !path.startsWith('/register') &&
        !path.startsWith('/auth')
    ) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // Redirect authenticated users away from login/register
    if (
        user &&
        (path.startsWith('/login') || path.startsWith('/register'))
    ) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    // Role-based and deactivation checks for authenticated users
    if (user) {
        const { data: profile } = await (supabase
            .from('profiles') as any)
            .select('role, is_active')
            .eq('id', user.id)
            .maybeSingle()

        // Deactivated user — sign out and redirect
        if (profile && profile.is_active === false) {
            await supabase.auth.signOut()
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            url.searchParams.set('reason', 'deactivated')
            return NextResponse.redirect(url)
        }

        const role = profile?.role

        // Viewer cannot access create/new routes or users settings
        if (role === 'viewer') {
            const isProtectedAction =
                path.endsWith('/new') ||
                path.includes('/new/') ||
                (path.startsWith('/settings') &&
                    request.nextUrl.searchParams.get('tab') === 'users')

            if (isProtectedAction) {
                const url = request.nextUrl.clone()
                if (path.startsWith('/invoices')) url.pathname = '/invoices'
                else if (path.startsWith('/bills')) url.pathname = '/bills'
                else if (path.startsWith('/expenses')) url.pathname = '/expenses'
                else if (path.startsWith('/settings')) {
                    url.pathname = '/settings'
                    url.searchParams.set('tab', 'company')