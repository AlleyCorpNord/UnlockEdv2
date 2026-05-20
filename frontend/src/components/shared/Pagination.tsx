import { useId } from 'react';
import { Label } from '@/components/ui/label';
import {
    Pagination as PaginationNav,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious
} from '@/components/ui/pagination';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface PaginationProps {
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (itemsPerPage: number) => void;
    itemLabel?: string;
    /** Merged onto the outer bar (e.g. alignment with a parent card). */
    className?: string;
}

function getPageNumbers(currentPage: number, totalPages: number) {
    const pages: (number | string)[] = [];

    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
        return pages;
    }

    pages.push(1);
    if (currentPage > 3) pages.push('...');

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);

    return pages;
}

export function Pagination({
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange,
    itemLabel = 'items',
    className
}: PaginationProps) {
    const perPageFieldId = useId();
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div
            data-slot="shared-pagination"
            className={cn(
                'rounded-b-lg border-t border-border bg-card px-6 py-4 text-card-foreground',
                className
            )}
        >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
                    <p className="text-sm text-muted-foreground">
                        Showing{' '}
                        <span className="font-medium text-foreground">
                            {startItem}-{endItem}
                        </span>{' '}
                        of{' '}
                        <span className="font-medium text-foreground">{totalItems}</span> {itemLabel}
                    </p>
                    <div className="flex items-center gap-2">
                        <Label
                            htmlFor={perPageFieldId}
                            className="whitespace-nowrap text-sm font-normal text-muted-foreground"
                        >
                            Items per page
                        </Label>
                        <Select
                            value={String(itemsPerPage)}
                            onValueChange={(value) => {
                                onItemsPerPageChange(Number(value));
                                onPageChange(1);
                            }}
                        >
                            <SelectTrigger id={perPageFieldId} className="w-[4.25rem] shrink-0">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent position="popper">
                                <SelectItem value="20">20</SelectItem>
                                <SelectItem value="40">40</SelectItem>
                                <SelectItem value="80">80</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <PaginationNav
                    className="mx-0 w-full justify-center sm:w-auto sm:justify-end"
                    aria-label="Table pagination"
                >
                    <PaginationContent className="flex-wrap justify-center gap-1">
                        <PaginationItem>
                            <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (currentPage > 1) onPageChange(currentPage - 1);
                                }}
                                className={cn(
                                    currentPage <= 1 && 'pointer-events-none opacity-50',
                                    'cursor-pointer'
                                )}
                            />
                        </PaginationItem>
                        {getPageNumbers(currentPage, totalPages).map((page, index) => {
                            if (page === '...') {
                                return (
                                    <PaginationItem key={`ellipsis-${index}`}>
                                        <PaginationEllipsis />
                                    </PaginationItem>
                                );
                            }
                            const num = page as number;
                            return (
                                <PaginationItem key={num}>
                                    <PaginationLink
                                        href="#"
                                        isActive={num === currentPage}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            onPageChange(num);
                                        }}
                                        className="min-w-9 cursor-pointer"
                                    >
                                        {num}
                                    </PaginationLink>
                                </PaginationItem>
                            );
                        })}
                        <PaginationItem>
                            <PaginationNext
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (currentPage < totalPages) onPageChange(currentPage + 1);
                                }}
                                className={cn(
                                    currentPage >= totalPages && 'pointer-events-none opacity-50',
                                    'cursor-pointer'
                                )}
                            />
                        </PaginationItem>
                    </PaginationContent>
                </PaginationNav>
            </div>
        </div>
    );
}
