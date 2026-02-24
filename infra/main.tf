terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # O backend será configurado parcialmente via CLI no GitHub Actions
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Angular-MFE"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
