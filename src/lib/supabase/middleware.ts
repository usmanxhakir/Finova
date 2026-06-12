/* eslint-disable @typescript-eslint/no-explicit-any */
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

    const isPublicApprovalRoute =
        path === '/approve-po' ||
        path.startsWith('/api/po-approval/')

    if (
        !user &&
        !isPublicApprovalRoute &&
        !path.startsWith('/login') &&
        !path.startsWith('/register') &&
        !path.startsWith('/auth')
    ) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    if (
        user &&
        (path.startsWith('/login') || path.startsWith('/register'))
    ) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    if (user) {
        const { data: profile } = await (supabase
            .from('profiles') as any)
            .select('role, is_active')
            .eq('id', user.id)
            .maybeSingle()

        if (profile && profile.is_active === false) {
            await supabase.auth.signOut()
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            url.searchParams.set('reason', 'deactivated')
            return NextResponse.redirect(url)
        }

        const role = profile?.role

        if (role === 'viewer') {
            const isProtectedAction =
                path.endsWith('/new') ||
                path.includes('/new/') ||
                (path.startsWith('/settings') &&
                    request.nextUrl.searchParams.get('tab') === 'users')

            if (isProtectedAction) {
                const url = request.nextUrl.clone()
                if (path.startsWith('/invoices')) {
                    url.pathname = '/invoices'
                } else if (path.startsWith('/bills')) {
                    url.pathname = '/bills'
                } else if (path.startsWith('/expenses')) {
                    url.pathname = '/expenses'
                } else if (path.startsWith('/settings')) {
                    url.pathname = '/settings'
                    url.searchParams.set('tab', 'company')
                } else {
                    url.pathname = '/dashboard'
                }
                return NextResponse.redirect(url)
            }
        }
    }

    return supabaseResponse
}
