import { Link, useLoaderData, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { useEffect } from 'react';
import { useAuth } from '@/auth/useAuth';
import {
    OpenContentItem,
    HelpfulLink,
    HelpfulLinkAndSort,
    Library,
    ServerResponseMany,
    ServerResponseOne
} from '@/types';
import TopContentList from '@/components/dashboard/TopContentList';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Award, BookOpen, ExternalLink, Star } from 'lucide-react';
import {
    DIGITAL_TRANSCRIPT_BASE,
    DIGITAL_TRANSCRIPT_ENTRY_PATH
} from '@/pages/student/digital-transcript/digitalTranscriptRoutes';
import { EmptyState } from '@/components/shared';
import { useTourContext } from '@/contexts/TourContext';
import { targetToStepIndexMap } from '@/components/UnlockEdTour';

interface ResidentHomeData {
    helpfulLinks: HelpfulLink[];
    topUserContent: OpenContentItem[];
    topFacilityContent: OpenContentItem[];
    favorites: OpenContentItem[];
}

function FeaturedLibraryCard({
    library,
    onClick
}: {
    library: Library;
    onClick: () => void;
}) {
    return (
        <div onClick={onClick} className="block cursor-pointer">
            <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                        {library.thumbnail_url ? (
                            <img
                                src={library.thumbnail_url}
                                alt={library.title}
                                className="size-12 rounded object-cover flex-shrink-0"
                            />
                        ) : (
                            <div className="size-12 rounded bg-muted flex-shrink-0" />
                        )}
                        <h4 className="text-sm font-medium text-foreground line-clamp-1">
                            {library.title}
                        </h4>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                        {library.description ?? ''}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

function HelpfulLinkCard({ link }: { link: HelpfulLink }) {
    return (
        <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
            <Card className="flex h-full min-h-[10.5rem] flex-col gap-4 p-5 sm:min-h-[11rem] sm:p-6 hover:shadow-md transition-shadow">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                    <ExternalLink
                        className="size-5 shrink-0 text-[#556830] dark:text-primary"
                        aria-hidden
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                        <h4 className="text-base font-semibold leading-snug text-foreground line-clamp-2">
                            {link.title}
                        </h4>
                        {link.description ? (
                            <p className="text-sm leading-relaxed text-muted-foreground line-clamp-4">
                                {link.description}
                            </p>
                        ) : null}
                    </div>
                </div>
            </Card>
        </a>
    );
}

function FavoriteItem({ item }: { item: OpenContentItem }) {
    return (
        <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:shadow-md transition-shadow"
        >
            {item.thumbnail_url ? (
                <img
                    src={item.thumbnail_url}
                    alt={item.title}
                    className="w-10 h-10 rounded object-cover shrink-0"
                />
            ) : (
                <div className="w-10 h-10 rounded bg-muted shrink-0" />
            )}
            <p className="text-sm text-foreground truncate">{item.title}</p>
        </a>
    );
}

function FavoritesPanel({ favoriteItems }: { favoriteItems: OpenContentItem[] }) {
    return (
        <div className="flex h-full w-full min-w-0 flex-col rounded-lg border border-gray-200 bg-card p-6">
            <div className="mb-4 flex shrink-0 items-center gap-2">
                <Star className="size-5 shrink-0 text-[#F1B51C]" />
                <h2 className="text-lg font-semibold text-foreground">Favorites</h2>
            </div>
            {favoriteItems.length > 0 ? (
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {favoriteItems.map((item) => (
                        <FavoriteItem
                            key={`${item.content_id}-${item.url}`}
                            item={item}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 text-center">
                    <p className="text-lg font-medium text-foreground">No Favorites Yet</p>
                    <p className="max-w-xs text-sm text-muted-foreground">
                        Content you favorite will appear here for quick access.
                    </p>
                </div>
            )}
        </div>
    );
}

export default function ResidentHome() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { topUserContent, topFacilityContent } =
        useLoaderData() as ResidentHomeData;
    const { tourState, setTourState } = useTourContext();

    const { data: featured } = useSWR<ServerResponseMany<Library>>(
        '/api/libraries?visibility=featured&order_by=created_at'
    );
    const { data: favorites } = useSWR<ServerResponseMany<OpenContentItem>>(
        '/api/open-content/favorite-groupings'
    );
    const { data: helpfulLinks } = useSWR<ServerResponseOne<HelpfulLinkAndSort>>(
        '/api/helpful-links'
    );

    useEffect(() => {
        if (tourState.tourActive && tourState.target === '#navigate-homepage') {
            setTourState({
                stepIndex: targetToStepIndexMap['#popular-content'],
                target: '#popular-content'
            });
        } else if (tourState.tourActive && tourState.stepIndex !== 1) {
            setTourState({
                run: true,
                stepIndex: 0,
                target: '#resident-home'
            });
        }
    }, [tourState.tourActive]);

    const featuredItems = featured?.data ?? [];
    const favoriteItems = favorites?.data ?? [];
    const links = helpfulLinks?.data?.helpful_links ?? [];
    const pickUpIsEmpty =
        topUserContent.length === 0 && topFacilityContent.length === 0;

    if (!user) return null;

    return (
        <div className="bg-muted min-h-screen p-6" id="resident-home">
            <div className="max-w-7xl mx-auto flex gap-6">
                <div className="flex-1 space-y-6">
                    <div className="mb-8">
                        <h1 className="text-[#203622] mb-2 dark:text-foreground">
                            Hi, {user.name_first ?? 'Student'}!
                        </h1>
                    </div>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-4">
                            Pick Up Where You Left Off
                        </h2>
                        {pickUpIsEmpty ? (
                            <div
                                className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-stretch"
                                id="end-tour"
                            >
                                <div className="flex min-h-[280px] h-full">
                                    <EmptyState
                                        className="h-full w-full rounded-lg border border-gray-200"
                                        icon={
                                            <BookOpen className="size-6 text-muted-foreground" />
                                        }
                                        title="No content yet"
                                        description="You have not opened any Knowledge Center items recently. Explore the library to get started."
                                        action={
                                            <Button asChild>
                                                <Link to="/knowledge-center">
                                                    Go to Knowledge Center
                                                </Link>
                                            </Button>
                                        }
                                    />
                                </div>
                                <div className="hidden min-h-[280px] h-full w-full xl:flex xl:flex-col">
                                    <FavoritesPanel favoriteItems={favoriteItems} />
                                </div>
                            </div>
                        ) : (
                            <div
                                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                                id="end-tour"
                            >
                                <div id="top-content">
                                    <TopContentList
                                        heading="Your Top Content"
                                        items={topUserContent}
                                        onViewAll={() =>
                                            navigate('/knowledge-center')
                                        }
                                    />
                                </div>
                                <div id="popular-content">
                                    <TopContentList
                                        heading="Popular Content"
                                        items={topFacilityContent}
                                        onViewAll={() =>
                                            navigate('/knowledge-center')
                                        }
                                    />
                                </div>
                            </div>
                        )}
                    </section>

                    {featuredItems.length > 0 && (
                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-4">
                                Featured Content
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {featuredItems.map((lib) => (
                                    <FeaturedLibraryCard
                                        key={`${lib.id}-${lib.open_content_provider_id}`}
                                        library={lib}
                                        onClick={() =>
                                            navigate(
                                                `/viewer/libraries/${lib.id}`
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    <section>
                        <Card className="border border-gray-200 shadow-sm dark:border-border">
                            <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                                <div className="flex min-w-0 gap-4">
                                    <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted">
                                        <Award
                                            className="size-5 text-[#556830] dark:text-primary"
                                            aria-hidden
                                        />
                                    </div>
                                    <div className="min-w-0 space-y-1">
                                        <h2 className="text-lg font-semibold text-foreground">
                                            Your Learning Record
                                        </h2>
                                        <p className="text-sm leading-relaxed text-muted-foreground">
                                            Review what you have logged and add a new achievement whenever you are
                                            ready.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                                    <Button asChild>
                                        <Link to={DIGITAL_TRANSCRIPT_BASE}>
                                            Open Learning Record
                                        </Link>
                                    </Button>
                                    <Button variant="outline" asChild>
                                        <Link to={`${DIGITAL_TRANSCRIPT_ENTRY_PATH}?intent=new`}>
                                            Add an achievement
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    {links.length > 0 && (
                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-2">
                                Helpful links
                            </h2>
                            <p className="mb-5 text-sm text-muted-foreground">
                                Each link opens in a new tab.
                            </p>
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                                {links.map((link) => (
                                    <HelpfulLinkCard
                                        key={`${link.id}-${link.url}`}
                                        link={link}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {!pickUpIsEmpty && (
                    <aside className="hidden xl:block w-[320px] shrink-0 space-y-6 sticky top-6 self-start">
                        <FavoritesPanel favoriteItems={favoriteItems} />
                    </aside>
                )}
            </div>
        </div>
    );
}
