package utils

import "context"

type ctxKey string

const claimsKey ctxKey = "auth_claims"

func WithClaims(ctx context.Context, c *Claims) context.Context {
	return context.WithValue(ctx, claimsKey, c)
}

func ClaimsFromContext(ctx context.Context) (*Claims, bool) {
	v := ctx.Value(claimsKey)
	c, ok := v.(*Claims)
	return c, ok
}
