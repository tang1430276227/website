import { useSearchParams, useNavigate } from 'react-router-dom';

export default function AuthError() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const message = searchParams.get('msg') || '认证过程中发生错误';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center mx-auto">
          <span className="text-destructive text-xl">✕</span>
        </div>
        <h2 className="text-xl font-semibold text-foreground">认证错误</h2>
        <p className="text-muted-foreground">{message}</p>
        <button
          onClick={() => navigate('/', { replace: true })}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
        >
          返回首页
        </button>
      </div>
    </div>
  );
}