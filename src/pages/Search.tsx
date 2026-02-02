import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Profile } from '@/types/database';
import { Search as SearchIcon, MessageCircle, UserPlus, Hash, Users } from 'lucide-react';

const Search = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      // Use public_profiles view to search users (doesn't require auth)
      // Filter out banned users (is_banned = false or null)
      let queryBuilder = supabase
        .from('public_profiles')
        .select('*')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%,user_id_code.ilike.%${query}%`)
        .limit(20);

      // Exclude current user from search results if logged in
      if (user) {
        queryBuilder = queryBuilder.neq('id', user.id);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      
      // Filter out banned users client-side since is_banned can be null
      const filteredData = (data || []).filter(p => !p.is_banned);
      setResults(filteredData as Profile[]);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
            <Users className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Tìm kiếm bạn bè</h1>
          <p className="text-muted-foreground">
            Tìm người dùng theo tên hoặc ID
          </p>
        </div>

        {/* Friends List Button */}
        <div className="flex justify-center">
          <Button
            onClick={() => navigate('/friends')}
            variant="outline"
            className="rounded-xl gap-2"
          >
            <Users className="w-4 h-4" />
            Danh sách bạn bè
          </Button>
        </div>

        {/* Search Bar */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Nhập tên người dùng hoặc ID..."
                className="pl-12 h-12 rounded-xl bg-secondary/50 text-lg"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              className="h-12 px-6 rounded-xl gradient-primary shadow-glow"
            >
              {isSearching ? 'Đang tìm...' : 'Tìm kiếm'}
            </Button>
          </div>
        </div>

        {/* Results */}
        {hasSearched && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              {results.length > 0
                ? `Tìm thấy ${results.length} kết quả`
                : 'Không tìm thấy kết quả'}
            </h2>

            {results.length > 0 ? (
              <div className="space-y-3">
                {results.map((profile) => (
                  <Link
                    key={profile.id}
                    to={`/profile/${profile.id}`}
                    className="glass rounded-2xl p-4 flex items-center gap-4 hover-lift animate-fade-in block"
                  >
                    <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                      <AvatarImage src={profile.avatar_url || ''} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                        {(profile.display_name || profile.username)?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">
                        {profile.display_name || profile.username}
                      </h3>
                      <p className="text-muted-foreground truncate">@{profile.username}</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Hash className="w-3 h-3" />
                        <span>{profile.user_id_code}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-1"
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = `/messages?user=${profile.id}`;
                        }}
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">Nhắn tin</span>
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-xl gap-1 gradient-primary"
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = `/profile/${profile.id}`;
                        }}
                      >
                        <UserPlus className="w-4 h-4" />
                        <span className="hidden sm:inline">Xem hồ sơ</span>
                      </Button>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="glass rounded-2xl p-8 text-center">
                <SearchIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Không tìm thấy người dùng nào với từ khóa "{query}"
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Search;