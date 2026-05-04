resource "aws_s3_bucket" "mfe_bucket" {
  bucket = var.bucket_name
}

# Configuração de Website Estático
resource "aws_s3_bucket_website_configuration" "mfe_website" {
  bucket = aws_s3_bucket.mfe_bucket.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

# Desbloquear acesso público (necessário para site estático simples sem CloudFront)
resource "aws_s3_bucket_public_access_block" "mfe_public_access" {
  bucket = aws_s3_bucket.mfe_bucket.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Política de Leitura Pública
resource "aws_s3_bucket_policy" "allow_public_access" {
  bucket     = aws_s3_bucket.mfe_bucket.id
  depends_on = [aws_s3_bucket_public_access_block.mfe_public_access]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.mfe_bucket.arn}/*"
      },
    ]
  })
}
